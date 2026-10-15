-- forum.ui-ux.agency — phase 2: uploads, email preference, ranked search, report checks, moderation RPCs.
-- Applied by `npm run db:migrate`.

-- ---------------------------------------------------------------------------
-- Email notification preference (users edit it like their other profile fields)
-- ---------------------------------------------------------------------------
alter table public.profiles add column email_notifications boolean not null default true;
grant update (email_notifications) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- Uploads (images stored in Cloudflare R2). Rows are written by record_upload()
-- before the object is stored, so the daily cap also covers failed uploads.
-- ---------------------------------------------------------------------------
create table public.uploads (
  id            bigint generated always as identity primary key,
  user_id       uuid references public.profiles (id) on delete set null,
  object_key    text not null unique check (object_key ~ '^(q|avatars)/[a-z0-9/_-]+\.(png|jpg|webp|gif)$'),
  content_type  text not null check (content_type in ('image/png', 'image/jpeg', 'image/webp', 'image/gif')),
  size_bytes    integer not null check (size_bytes between 1 and 5242880),
  created_at    timestamptz not null default now()
);
create index uploads_user_idx on public.uploads (user_id, created_at desc);
alter table public.uploads enable row level security;
revoke all on public.uploads from anon, authenticated;

create or replace function public.record_upload(p_key text, p_content_type text, p_size int)
returns void language plpgsql security definer set search_path = public as $$
declare
  me     public.profiles := public.assert_can_post();
  is_new boolean := me.created_at > now() - interval '3 days' or me.reputation < 50;
  used   int;
begin
  if not public.is_staff(me.id) then
    select count(*) into used from public.uploads
     where user_id = me.id and created_at > now() - interval '1 day';
    if used >= (case when is_new then 10 else 50 end) then
      raise exception 'Daily upload limit reached. Please try again tomorrow.' using errcode = 'P0429';
    end if;
  end if;
  insert into public.uploads (user_id, object_key, content_type, size_bytes)
    values (me.id, p_key, p_content_type, p_size);
end $$;

-- ---------------------------------------------------------------------------
-- Ranked search with optional category / tag filters. Runs as the caller (RLS applies).
-- ---------------------------------------------------------------------------
create or replace function public.search_questions(
  p_query text, p_category_slug text default null, p_tag text default null,
  p_limit int default 30, p_offset int default 0)
returns table (id bigint, rank real)
language sql stable set search_path = public as $$
  select q.id,
         (ts_rank_cd(q.search_vector, query, 32) * (1 + ln(1 + greatest(q.score, 0) + q.answer_count)))::real as rank
    from public.questions q, websearch_to_tsquery('english', coalesce(p_query, '')) query
   where not q.is_deleted
     and q.search_vector @@ query
     and (p_category_slug is null
          or q.category_id = (select c.id from public.categories c where c.slug = p_category_slug))
     and (p_tag is null or exists (
          select 1 from public.question_tags qt join public.tags t on t.id = qt.tag_id
           where qt.question_id = q.id and t.slug = p_tag))
   order by rank desc, q.created_at desc
   limit least(greatest(coalesce(p_limit, 30), 1), 50)
  offset least(greatest(coalesce(p_offset, 0), 0), 1000)
$$;

-- ---------------------------------------------------------------------------
-- Reports: the target must exist.
-- ---------------------------------------------------------------------------
create or replace function public.create_report(p_target_type text, p_target_id text, p_reason text, p_details text default '')
returns void language plpgsql security definer set search_path = public as $$
declare
  me public.profiles := public.assert_can_post();
  ok boolean;
begin
  perform public.check_rate_limit('report', me);
  ok := case p_target_type
    when 'question' then p_target_id ~ '^\d{1,18}$' and exists (select 1 from public.questions where id = p_target_id::bigint)
    when 'answer'   then p_target_id ~ '^\d{1,18}$' and exists (select 1 from public.answers   where id = p_target_id::bigint)
    when 'comment'  then p_target_id ~ '^\d{1,18}$' and exists (select 1 from public.comments  where id = p_target_id::bigint)
    when 'user'     then p_target_id ~* '^[0-9a-f-]{36}$' and exists (select 1 from public.profiles where id = p_target_id::uuid)
    else false
  end;
  if not ok then
    raise exception 'Nothing to report here.' using errcode = 'P0002';
  end if;
  insert into public.reports (reporter_id, target_type, target_id, reason, details)
    values (me.id, p_target_type, p_target_id, p_reason, left(coalesce(p_details, ''), 500))
    on conflict (reporter_id, target_type, target_id) do nothing;
end $$;

-- ---------------------------------------------------------------------------
-- Moderation. Every action is written to moderation_log.
-- ---------------------------------------------------------------------------
create or replace function public.assert_staff()
returns public.profiles language plpgsql stable security definer set search_path = public as $$
declare
  me public.profiles := public.assert_can_post();
begin
  if me.role not in ('moderator', 'admin') then
    raise exception 'Moderators only.' using errcode = '42501';
  end if;
  return me;
end $$;

create or replace function public.mod_log(p_me uuid, p_action text, p_type text, p_id text, p_note text)
returns void language sql security definer set search_path = public as $$
  insert into public.moderation_log (moderator_id, action, target_type, target_id, note)
    values (p_me, p_action, p_type, p_id, nullif(left(trim(coalesce(p_note, '')), 500), ''))
$$;

create or replace function public.mod_set_lock(p_question_id bigint, p_locked boolean, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  me public.profiles := public.assert_staff();
begin
  update public.questions set is_locked = p_locked where id = p_question_id;
  if not found then raise exception 'Question not found.' using errcode = 'P0002'; end if;
  perform public.mod_log(me.id, case when p_locked then 'lock' else 'unlock' end, 'question', p_question_id::text, p_note);
end $$;

create or replace function public.mod_restore_post(p_type text, p_id bigint, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  me   public.profiles := public.assert_staff();
  q_id bigint;
begin
  if p_type = 'question' then
    update public.questions set is_deleted = false where id = p_id and is_deleted;
    if not found then raise exception 'Nothing to restore.' using errcode = 'P0002'; end if;
    update public.tags set question_count = question_count + 1
     where id in (select tag_id from public.question_tags where question_id = p_id);
  elsif p_type = 'answer' then
    update public.answers set is_deleted = false where id = p_id and is_deleted returning question_id into q_id;
    if not found then raise exception 'Nothing to restore.' using errcode = 'P0002'; end if;
    update public.questions set answer_count = answer_count + 1 where id = q_id;
  elsif p_type = 'comment' then
    update public.comments set is_deleted = false where id = p_id and is_deleted
      returning coalesce(question_id, (select a.question_id from public.answers a where a.id = answer_id)) into q_id;
    if not found then raise exception 'Nothing to restore.' using errcode = 'P0002'; end if;
    update public.questions set comment_count = comment_count + 1 where id = q_id;
  else
    raise exception 'Unknown type.' using errcode = '22023';
  end if;
  perform public.mod_log(me.id, 'restore', p_type, p_id::text, p_note);
end $$;

-- p_days null = until unbanned.
create or replace function public.mod_ban_user(p_user uuid, p_days int default null, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  me     public.profiles := public.assert_staff();
  target public.profiles;
begin
  select * into target from public.profiles where id = p_user;
  if not found then raise exception 'User not found.' using errcode = 'P0002'; end if;
  if target.id = me.id then raise exception 'You cannot ban yourself.' using errcode = '42501'; end if;
  if target.role <> 'user' and me.role <> 'admin' then
    raise exception 'Only admins can ban staff.' using errcode = '42501';
  end if;
  if p_days is not null and (p_days < 1 or p_days > 3650) then
    raise exception 'Ban length must be 1–3650 days.' using errcode = '22023';
  end if;
  update public.profiles
     set is_banned = true,
         banned_until = case when p_days is null then null else now() + make_interval(days => p_days) end
   where id = p_user;
  perform public.mod_log(me.id, 'ban', 'user', p_user::text,
    concat_ws(' — ', case when p_days is null then 'permanent' else p_days || ' days' end, p_note));
end $$;

create or replace function public.mod_unban_user(p_user uuid, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  me public.profiles := public.assert_staff();
begin
  update public.profiles set is_banned = false, banned_until = null where id = p_user;
  if not found then raise exception 'User not found.' using errcode = 'P0002'; end if;
  perform public.mod_log(me.id, 'unban', 'user', p_user::text, p_note);
end $$;

create or replace function public.mod_resolve_report(p_report_id bigint, p_status text, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  me public.profiles := public.assert_staff();
begin
  if p_status not in ('resolved', 'dismissed', 'open') then
    raise exception 'Invalid status.' using errcode = '22023';
  end if;
  update public.reports
     set status = p_status,
         resolved_by = case when p_status = 'open' then null else me.id end,
         resolved_at = case when p_status = 'open' then null else now() end
   where id = p_report_id;
  if not found then raise exception 'Report not found.' using errcode = 'P0002'; end if;
  perform public.mod_log(me.id, 'report_' || p_status, 'report', p_report_id::text, p_note);
end $$;

create or replace function public.mod_set_role(p_user uuid, p_role text)
returns void language plpgsql security definer set search_path = public as $$
declare
  me public.profiles := public.assert_staff();
begin
  if me.role <> 'admin' then raise exception 'Admins only.' using errcode = '42501'; end if;
  if p_user = me.id then raise exception 'You cannot change your own role.' using errcode = '42501'; end if;
  if p_role not in ('user', 'moderator', 'admin') then raise exception 'Invalid role.' using errcode = '22023'; end if;
  update public.profiles set role = p_role where id = p_user;
  if not found then raise exception 'User not found.' using errcode = 'P0002'; end if;
  perform public.mod_log(me.id, 'role_' || p_role, 'user', p_user::text, null);
end $$;

-- ---------------------------------------------------------------------------
-- Execute grants
-- ---------------------------------------------------------------------------
revoke execute on function public.record_upload(text, text, int)                      from public, anon, authenticated;
revoke execute on function public.search_questions(text, text, text, int, int)        from public, anon, authenticated;
revoke execute on function public.create_report(text, text, text, text)               from public, anon, authenticated;
revoke execute on function public.assert_staff()                                      from public, anon, authenticated;
revoke execute on function public.mod_log(uuid, text, text, text, text)               from public, anon, authenticated;
revoke execute on function public.mod_set_lock(bigint, boolean, text)                 from public, anon, authenticated;
revoke execute on function public.mod_restore_post(text, bigint, text)                from public, anon, authenticated;
revoke execute on function public.mod_ban_user(uuid, int, text)                       from public, anon, authenticated;
revoke execute on function public.mod_unban_user(uuid, text)                          from public, anon, authenticated;
revoke execute on function public.mod_resolve_report(bigint, text, text)              from public, anon, authenticated;
revoke execute on function public.mod_set_role(uuid, text)                            from public, anon, authenticated;

grant execute on function public.search_questions(text, text, text, int, int) to anon, authenticated;
grant execute on function public.record_upload(text, text, int)               to authenticated;
grant execute on function public.create_report(text, text, text, text)        to authenticated;
grant execute on function public.mod_set_lock(bigint, boolean, text)          to authenticated;
grant execute on function public.mod_restore_post(text, bigint, text)         to authenticated;
grant execute on function public.mod_ban_user(uuid, int, text)                to authenticated;
grant execute on function public.mod_unban_user(uuid, text)                   to authenticated;
grant execute on function public.mod_resolve_report(bigint, text, text)       to authenticated;
grant execute on function public.mod_set_role(uuid, text)                     to authenticated;
