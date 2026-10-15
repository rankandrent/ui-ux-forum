-- forum.ui-ux.agency — functions, triggers and write RPCs.
-- All writes to forum content go through SECURITY DEFINER functions below, which
-- check auth.uid(), bans, locks and rate limits. Tables have no direct write
-- policies for clients (see 0003_rls.sql), except a user's own profile fields.

-- ---------------------------------------------------------------------------
-- Generic helpers
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

create or replace function public.slugify(p_text text, p_max int default 80)
returns text language sql immutable as $$
  select coalesce(nullif(trim(both '-' from left(
    trim(both '-' from regexp_replace(lower(coalesce(p_text, '')), '[^a-z0-9]+', '-', 'g')),
    p_max)), ''), 'question')
$$;

create or replace function public.is_staff(p_user uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = p_user and role in ('moderator', 'admin')
  )
$$;

create or replace function public.is_admin(p_user uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = p_user and role = 'admin')
$$;

-- Raises unless the caller is signed in and not banned. Returns the caller's profile.
create or replace function public.assert_can_post()
returns public.profiles language plpgsql stable security definer set search_path = public as $$
declare
  me public.profiles;
begin
  if auth.uid() is null then
    raise exception 'You need to sign in first.' using errcode = '28000';
  end if;
  select * into me from public.profiles where id = auth.uid();
  if not found then
    raise exception 'Profile not found.' using errcode = '28000';
  end if;
  if me.is_banned and (me.banned_until is null or me.banned_until > now()) then
    raise exception 'Your account is suspended.' using errcode = '42501';
  end if;
  return me;
end $$;

-- ---------------------------------------------------------------------------
-- Rate limits. "New" users = account younger than 3 days or reputation < 50.
-- ---------------------------------------------------------------------------
create or replace function public.check_rate_limit(p_kind text, p_me public.profiles)
returns void language plpgsql stable security definer set search_path = public as $$
declare
  is_new   boolean := p_me.created_at > now() - interval '3 days' or p_me.reputation < 50;
  day_cap  int;
  used     int;
  last_at  timestamptz;
begin
  if public.is_staff(p_me.id) then
    return;
  end if;

  day_cap := case p_kind
    when 'question' then case when is_new then 3  else 15  end
    when 'answer'   then case when is_new then 10 else 60  end
    when 'comment'  then case when is_new then 20 else 150 end
    when 'vote'     then case when is_new then 40 else 300 end
    when 'report'   then case when is_new then 10 else 50  end
  end;

  if p_kind = 'question' then
    select count(*), max(created_at) into used, last_at from public.questions
      where author_id = p_me.id and created_at > now() - interval '1 day';
  elsif p_kind = 'answer' then
    select count(*), max(created_at) into used, last_at from public.answers
      where author_id = p_me.id and created_at > now() - interval '1 day';
  elsif p_kind = 'comment' then
    select count(*), max(created_at) into used, last_at from public.comments
      where author_id = p_me.id and created_at > now() - interval '1 day';
  elsif p_kind = 'vote' then
    select (select count(*) from public.question_votes where user_id = p_me.id and created_at > now() - interval '1 day')
         + (select count(*) from public.answer_votes  where user_id = p_me.id and created_at > now() - interval '1 day')
      into used;
  elsif p_kind = 'report' then
    select count(*) into used from public.reports
      where reporter_id = p_me.id and created_at > now() - interval '1 day';
  else
    raise exception 'Unknown rate limit kind %', p_kind;
  end if;

  if used >= day_cap then
    raise exception 'Daily limit reached. New accounts have lower limits — please try again tomorrow.'
      using errcode = 'P0429';
  end if;

  if is_new and p_kind in ('question', 'answer') and last_at > now() - interval '60 seconds' then
    raise exception 'Please wait a minute before posting again.' using errcode = 'P0429';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Reputation & badges
-- ---------------------------------------------------------------------------
-- Sets (or clears, when p_delta = 0) the reputation event identified by p_key.
create or replace function public.set_reputation(p_user uuid, p_key text, p_delta int, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare
  old_delta int;
begin
  if p_user is null then
    return;
  end if;
  delete from public.reputation_events where source_key = p_key returning delta into old_delta;
  if p_delta <> 0 then
    insert into public.reputation_events (user_id, delta, reason, source_key)
      values (p_user, p_delta, p_reason, p_key);
  end if;
  update public.profiles
     set reputation = reputation - coalesce(old_delta, 0) + p_delta
   where id = p_user;
end $$;

create or replace function public.award_badge(p_user uuid, p_badge text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_user is null then
    return;
  end if;
  insert into public.user_badges (user_id, badge_slug) values (p_user, p_badge)
    on conflict do nothing;
  if found then
    insert into public.notifications (user_id, type, message)
      select p_user, 'badge', 'You earned the "' || name || '" badge.'
        from public.badges where slug = p_badge;
  end if;
end $$;

create or replace function public.check_reputation_badges(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  rep int;
begin
  select reputation into rep from public.profiles where id = p_user;
  if rep >= 100  then perform public.award_badge(p_user, 'rep-100');  end if;
  if rep >= 1000 then perform public.award_badge(p_user, 'rep-1000'); end if;
end $$;

-- ---------------------------------------------------------------------------
-- New user → profile
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  base   text;
  uname  text;
  dname  text;
  avatar text;
begin
  base := left(regexp_replace(lower(split_part(coalesce(new.email, 'user'), '@', 1)), '[^a-z0-9_]', '', 'g'), 20);
  if char_length(base) < 3 then
    base := 'user';
  end if;
  uname := base;
  while exists (select 1 from public.profiles where username = uname) loop
    uname := base || '_' || substr(md5(random()::text), 1, 5);
  end loop;

  dname := left(coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
    uname), 60);

  avatar := new.raw_user_meta_data ->> 'avatar_url';
  if avatar is not null and avatar !~* '^https://' then
    avatar := null;
  end if;

  insert into public.profiles (id, username, display_name, avatar_url)
    values (new.id, uname, dname, avatar);
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Tags helper: normalizes and links 1–5 tags to a question.
-- ---------------------------------------------------------------------------
create or replace function public.set_question_tags(p_question_id bigint, p_tags text[])
returns void language plpgsql security definer set search_path = public as $$
declare
  clean text[];
  t     text;
  tid   int;
begin
  select coalesce(array_agg(distinct s), '{}') into clean
    from (
      select trim(both '-' from left(trim(both '-' from
               regexp_replace(lower(trim(x)), '[^a-z0-9]+', '-', 'g')), 30)) as s
        from unnest(coalesce(p_tags, '{}')) as x
    ) q
   where s <> '';

  if cardinality(clean) < 1 or cardinality(clean) > 5 then
    raise exception 'Add between 1 and 5 tags.' using errcode = '22023';
  end if;

  update public.tags set question_count = greatest(question_count - 1, 0)
   where id in (select tag_id from public.question_tags where question_id = p_question_id);
  delete from public.question_tags where question_id = p_question_id;

  foreach t in array clean loop
    insert into public.tags (slug) values (t)
      on conflict (slug) do update set slug = excluded.slug
      returning id into tid;
    insert into public.question_tags (question_id, tag_id) values (p_question_id, tid);
    update public.tags set question_count = question_count + 1 where id = tid;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Questions
-- ---------------------------------------------------------------------------
create or replace function public.create_question(
  p_title text, p_body text, p_category_slug text, p_tags text[], p_image_url text default null)
returns table (id bigint, slug text)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  me     public.profiles := public.assert_can_post();
  cat_id smallint;
  new_id bigint;
  new_slug text := public.slugify(p_title);
begin
  perform public.check_rate_limit('question', me);

  select c.id into cat_id from public.categories c where c.slug = p_category_slug;
  if cat_id is null then
    raise exception 'Choose a valid category.' using errcode = '22023';
  end if;

  insert into public.questions (author_id, category_id, title, slug, body, image_url)
    values (me.id, cat_id, trim(p_title), new_slug, trim(p_body), nullif(trim(coalesce(p_image_url, '')), ''))
    returning questions.id into new_id;

  perform public.set_question_tags(new_id, p_tags);
  perform public.award_badge(me.id, 'first-question');

  return query select new_id, new_slug;
end $$;

create or replace function public.update_question(
  p_id bigint, p_title text, p_body text, p_category_slug text, p_tags text[], p_image_url text default null)
returns table (id bigint, slug text)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  me     public.profiles := public.assert_can_post();
  q      public.questions;
  cat_id smallint;
  new_slug text := public.slugify(p_title);
begin
  select * into q from public.questions where questions.id = p_id for update;
  if not found or (q.is_deleted and not public.is_staff()) then
    raise exception 'Question not found.' using errcode = 'P0002';
  end if;
  if q.author_id is distinct from me.id and not public.is_staff() then
    raise exception 'You can only edit your own questions.' using errcode = '42501';
  end if;
  if q.is_locked and not public.is_staff() then
    raise exception 'This question is locked.' using errcode = '42501';
  end if;

  select c.id into cat_id from public.categories c where c.slug = p_category_slug;
  if cat_id is null then
    raise exception 'Choose a valid category.' using errcode = '22023';
  end if;

  update public.questions
     set title = trim(p_title), slug = new_slug, body = trim(p_body), category_id = cat_id,
         image_url = nullif(trim(coalesce(p_image_url, '')), ''),
         updated_at = now(), last_activity_at = now()
   where questions.id = p_id;

  perform public.set_question_tags(p_id, p_tags);

  if q.author_id is distinct from me.id then
    insert into public.moderation_log (moderator_id, action, target_type, target_id)
      values (me.id, 'edit', 'question', p_id::text);
  end if;

  return query select p_id, new_slug;
end $$;

-- Lightweight view counter (callable anonymously).
create or replace function public.record_question_view(p_id bigint)
returns void language sql security definer set search_path = public as $$
  update public.questions set view_count = view_count + 1 where id = p_id and not is_deleted
$$;

-- ---------------------------------------------------------------------------
-- Answers
-- ---------------------------------------------------------------------------
create or replace function public.create_answer(p_question_id bigint, p_body text)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  me     public.profiles := public.assert_can_post();
  q      public.questions;
  new_id bigint;
begin
  select * into q from public.questions where id = p_question_id for update;
  if not found or q.is_deleted then
    raise exception 'Question not found.' using errcode = 'P0002';
  end if;
  if q.is_locked then
    raise exception 'This question is locked.' using errcode = '42501';
  end if;
  perform public.check_rate_limit('answer', me);

  insert into public.answers (question_id, author_id, body)
    values (p_question_id, me.id, trim(p_body))
    returning id into new_id;

  update public.questions
     set answer_count = answer_count + 1, last_activity_at = now()
   where id = p_question_id;

  if q.author_id is not null and q.author_id <> me.id then
    insert into public.notifications (user_id, actor_id, type, question_id, answer_id)
      values (q.author_id, me.id, 'answer', p_question_id, new_id);
  end if;

  perform public.award_badge(me.id, 'first-answer');
  return new_id;
end $$;

create or replace function public.update_answer(p_id bigint, p_body text)
returns void language plpgsql security definer set search_path = public as $$
declare
  me public.profiles := public.assert_can_post();
  a  public.answers;
  locked boolean;
begin
  select * into a from public.answers where id = p_id for update;
  if not found or (a.is_deleted and not public.is_staff()) then
    raise exception 'Answer not found.' using errcode = 'P0002';
  end if;
  if a.author_id is distinct from me.id and not public.is_staff() then
    raise exception 'You can only edit your own answers.' using errcode = '42501';
  end if;
  select is_locked into locked from public.questions where id = a.question_id;
  if locked and not public.is_staff() then
    raise exception 'This question is locked.' using errcode = '42501';
  end if;

  update public.answers set body = trim(p_body), updated_at = now() where id = p_id;

  if a.author_id is distinct from me.id then
    insert into public.moderation_log (moderator_id, action, target_type, target_id)
      values (me.id, 'edit', 'answer', p_id::text);
  end if;
end $$;

-- Accept (or un-accept) an answer. Only the question author can do this.
create or replace function public.accept_answer(p_answer_id bigint)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  me public.profiles := public.assert_can_post();
  a  public.answers;
  q  public.questions;
  now_accepted boolean;
begin
  select * into a from public.answers where id = p_answer_id;
  if not found or a.is_deleted then
    raise exception 'Answer not found.' using errcode = 'P0002';
  end if;
  select * into q from public.questions where id = a.question_id for update;
  if q.author_id is distinct from me.id then
    raise exception 'Only the person who asked can accept an answer.' using errcode = '42501';
  end if;
  if q.is_locked then
    raise exception 'This question is locked.' using errcode = '42501';
  end if;

  -- Clear any previous acceptance (and its reputation).
  if q.accepted_answer_id is not null then
    update public.answers set is_accepted = false where id = q.accepted_answer_id;
    perform public.set_reputation(
      (select author_id from public.answers where id = q.accepted_answer_id),
      'accept:' || q.accepted_answer_id, 0, 'answer accepted');
    perform public.set_reputation(me.id, 'acceptor:' || q.id, 0, 'accepted an answer');
  end if;

  if q.accepted_answer_id = p_answer_id then
    update public.questions set accepted_answer_id = null where id = q.id;
    now_accepted := false;
  else
    update public.answers set is_accepted = true where id = p_answer_id;
    update public.questions set accepted_answer_id = p_answer_id, last_activity_at = now() where id = q.id;
    now_accepted := true;
    if a.author_id is distinct from me.id then
      perform public.set_reputation(a.author_id, 'accept:' || p_answer_id, 15, 'answer accepted');
      perform public.set_reputation(me.id, 'acceptor:' || q.id, 2, 'accepted an answer');
      perform public.award_badge(a.author_id, 'problem-solver');
      perform public.check_reputation_badges(a.author_id);
      insert into public.notifications (user_id, actor_id, type, question_id, answer_id)
        values (a.author_id, me.id, 'accepted', q.id, p_answer_id);
    end if;
  end if;

  return now_accepted;
end $$;

-- ---------------------------------------------------------------------------
-- Comments
-- ---------------------------------------------------------------------------
create or replace function public.create_comment(p_question_id bigint, p_answer_id bigint, p_body text)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  me      public.profiles := public.assert_can_post();
  q       public.questions;
  a       public.answers;
  new_id  bigint;
  notify  uuid;
begin
  if num_nonnulls(p_question_id, p_answer_id) <> 1 then
    raise exception 'Comment must target a question or an answer.' using errcode = '22023';
  end if;

  if p_answer_id is not null then
    select * into a from public.answers where id = p_answer_id;
    if not found or a.is_deleted then
      raise exception 'Answer not found.' using errcode = 'P0002';
    end if;
    select * into q from public.questions where id = a.question_id;
    notify := a.author_id;
  else
    select * into q from public.questions where id = p_question_id;
    notify := q.author_id;
  end if;

  if q.id is null or q.is_deleted then
    raise exception 'Question not found.' using errcode = 'P0002';
  end if;
  if q.is_locked then
    raise exception 'This question is locked.' using errcode = '42501';
  end if;
  perform public.check_rate_limit('comment', me);

  insert into public.comments (author_id, question_id, answer_id, body)
    values (me.id, p_question_id, p_answer_id, trim(p_body))
    returning id into new_id;

  update public.questions set comment_count = comment_count + 1, last_activity_at = now() where id = q.id;

  if notify is not null and notify <> me.id then
    insert into public.notifications (user_id, actor_id, type, question_id, answer_id, comment_id)
      values (notify, me.id, 'comment', q.id, p_answer_id, new_id);
  end if;

  return new_id;
end $$;

-- ---------------------------------------------------------------------------
-- Soft delete (authors for their own content, staff for anything)
-- ---------------------------------------------------------------------------
create or replace function public.delete_post(p_type text, p_id bigint)
returns void language plpgsql security definer set search_path = public as $$
declare
  me       public.profiles := public.assert_can_post();
  staff    boolean := public.is_staff();
  owner_id uuid;
  q_id     bigint;
begin
  if p_type = 'question' then
    select author_id into owner_id from public.questions where id = p_id and not is_deleted;
    if not found then raise exception 'Question not found.' using errcode = 'P0002'; end if;
    if not staff then
      if owner_id is distinct from me.id then
        raise exception 'Not allowed.' using errcode = '42501';
      end if;
      if exists (select 1 from public.answers where question_id = p_id and not is_deleted) then
        raise exception 'Questions with answers can only be removed by a moderator.' using errcode = '42501';
      end if;
    end if;
    update public.questions set is_deleted = true where id = p_id;
    update public.tags set question_count = greatest(question_count - 1, 0)
     where id in (select tag_id from public.question_tags where question_id = p_id);

  elsif p_type = 'answer' then
    select author_id, question_id into owner_id, q_id from public.answers where id = p_id and not is_deleted;
    if not found then raise exception 'Answer not found.' using errcode = 'P0002'; end if;
    if not staff and owner_id is distinct from me.id then
      raise exception 'Not allowed.' using errcode = '42501';
    end if;
    update public.answers set is_deleted = true, is_accepted = false where id = p_id;
    update public.questions
       set answer_count = greatest(answer_count - 1, 0),
           accepted_answer_id = case when accepted_answer_id = p_id then null else accepted_answer_id end
     where id = q_id;
    perform public.set_reputation(owner_id, 'accept:' || p_id, 0, 'answer accepted');

  elsif p_type = 'comment' then
    select author_id, coalesce(c.question_id, (select question_id from public.answers where id = c.answer_id))
      into owner_id, q_id from public.comments c where c.id = p_id and not c.is_deleted;
    if not found then raise exception 'Comment not found.' using errcode = 'P0002'; end if;
    if not staff and owner_id is distinct from me.id then
      raise exception 'Not allowed.' using errcode = '42501';
    end if;
    update public.comments set is_deleted = true where id = p_id;
    update public.questions set comment_count = greatest(comment_count - 1, 0) where id = q_id;
  else
    raise exception 'Unknown type.' using errcode = '22023';
  end if;

  if staff and owner_id is distinct from me.id then
    insert into public.moderation_log (moderator_id, action, target_type, target_id)
      values (me.id, 'delete', p_type, p_id::text);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Voting. p_value: 1 (up), -1 (down), 0 (remove). Returns the new score.
-- Reputation: question +5 / -2, answer +10 / -2 (for the author).
-- ---------------------------------------------------------------------------
create or replace function public.cast_vote(p_type text, p_id bigint, p_value int)
returns integer language plpgsql security definer set search_path = public as $$
declare
  me        public.profiles := public.assert_can_post();
  owner_id  uuid;
  locked    boolean;
  old_value int;
  new_score int;
  rep_delta int;
begin
  if p_value not in (-1, 0, 1) then
    raise exception 'Invalid vote.' using errcode = '22023';
  end if;
  if p_value = -1 and me.reputation < 15 and not public.is_staff() then
    raise exception 'You need 15 reputation to downvote.' using errcode = '42501';
  end if;

  if p_type = 'question' then
    select author_id, is_locked into owner_id, locked from public.questions where id = p_id and not is_deleted;
    if not found then raise exception 'Question not found.' using errcode = 'P0002'; end if;
    select value into old_value from public.question_votes where user_id = me.id and question_id = p_id;
  elsif p_type = 'answer' then
    select a.author_id, q.is_locked into owner_id, locked
      from public.answers a join public.questions q on q.id = a.question_id
     where a.id = p_id and not a.is_deleted and not q.is_deleted;
    if not found then raise exception 'Answer not found.' using errcode = 'P0002'; end if;
    select value into old_value from public.answer_votes where user_id = me.id and answer_id = p_id;
  else
    raise exception 'Unknown type.' using errcode = '22023';
  end if;

  if owner_id = me.id then
    raise exception 'You cannot vote on your own post.' using errcode = '42501';
  end if;
  if locked then
    raise exception 'This question is locked.' using errcode = '42501';
  end if;

  old_value := coalesce(old_value, 0);
  if old_value = p_value then
    -- no change
    null;
  else
    if old_value = 0 then
      perform public.check_rate_limit('vote', me);
    end if;

    if p_type = 'question' then
      if p_value = 0 then
        delete from public.question_votes where user_id = me.id and question_id = p_id;
      else
        insert into public.question_votes (user_id, question_id, value) values (me.id, p_id, p_value)
          on conflict (user_id, question_id) do update set value = excluded.value;
      end if;
      update public.questions set score = score - old_value + p_value where id = p_id;
      rep_delta := case p_value when 1 then 5 when -1 then -2 else 0 end;
      perform public.set_reputation(owner_id, 'qvote:' || p_id || ':' || me.id, rep_delta, 'question vote');
    else
      if p_value = 0 then
        delete from public.answer_votes where user_id = me.id and answer_id = p_id;
      else
        insert into public.answer_votes (user_id, answer_id, value) values (me.id, p_id, p_value)
          on conflict (user_id, answer_id) do update set value = excluded.value;
      end if;
      update public.answers set score = score - old_value + p_value where id = p_id;
      rep_delta := case p_value when 1 then 10 when -1 then -2 else 0 end;
      perform public.set_reputation(owner_id, 'avote:' || p_id || ':' || me.id, rep_delta, 'answer vote');
    end if;

    if p_value = 1 and owner_id is not null then
      perform public.check_reputation_badges(owner_id);
    end if;
  end if;

  if p_type = 'question' then
    select score into new_score from public.questions where id = p_id;
    if new_score >= 10 then perform public.award_badge(owner_id, 'nice-question'); end if;
  else
    select score into new_score from public.answers where id = p_id;
    if new_score >= 10 then perform public.award_badge(owner_id, 'good-answer'); end if;
  end if;
  return new_score;
end $$;

-- ---------------------------------------------------------------------------
-- Reports & notifications (UI arrives in phase 2; functions are ready now)
-- ---------------------------------------------------------------------------
create or replace function public.create_report(p_target_type text, p_target_id text, p_reason text, p_details text default '')
returns void language plpgsql security definer set search_path = public as $$
declare
  me public.profiles := public.assert_can_post();
begin
  perform public.check_rate_limit('report', me);
  insert into public.reports (reporter_id, target_type, target_id, reason, details)
    values (me.id, p_target_type, p_target_id, p_reason, left(coalesce(p_details, ''), 500))
    on conflict (reporter_id, target_type, target_id) do nothing;
end $$;

create or replace function public.mark_notifications_read(p_ids bigint[] default null)
returns void language sql security definer set search_path = public as $$
  update public.notifications set read_at = now()
   where user_id = auth.uid() and read_at is null
     and (p_ids is null or id = any (p_ids))
$$;

-- ---------------------------------------------------------------------------
-- Execute grants: write RPCs for signed-in users only.
-- ---------------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function public.slugify(text, int)              to anon, authenticated;
grant execute on function public.is_staff(uuid)                  to anon, authenticated;
grant execute on function public.is_admin(uuid)                  to anon, authenticated;
grant execute on function public.record_question_view(bigint)    to anon, authenticated;

grant execute on function public.create_question(text, text, text, text[], text)        to authenticated;
grant execute on function public.update_question(bigint, text, text, text, text[], text) to authenticated;
grant execute on function public.create_answer(bigint, text)                            to authenticated;
grant execute on function public.update_answer(bigint, text)                            to authenticated;
grant execute on function public.accept_answer(bigint)                                  to authenticated;
grant execute on function public.create_comment(bigint, bigint, text)                   to authenticated;
grant execute on function public.delete_post(text, bigint)                              to authenticated;
grant execute on function public.cast_vote(text, bigint, int)                           to authenticated;
grant execute on function public.create_report(text, text, text, text)                  to authenticated;
grant execute on function public.mark_notifications_read(bigint[])                      to authenticated;
