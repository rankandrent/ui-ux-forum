-- forum.ui-ux.agency — indexing rules (owner, 2026-10-16): every active member's profile and every
-- visible thread is indexable. Safeguards: profiles need at least one live post; banned users'
-- profiles and threads stay out.

create or replace function public.user_is_banned(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select is_banned and (banned_until is null or banned_until > now()) from public.profiles where id = p_user
  ), false)
$$;

-- Profile is indexable: not banned and at least one non-deleted question, answer or comment.
create or replace function public.profile_is_indexable(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select not public.user_is_banned(p_user) and (
       exists (select 1 from public.questions where author_id = p_user and not is_deleted)
    or exists (select 1 from public.answers   where author_id = p_user and not is_deleted)
    or exists (select 1 from public.comments  where author_id = p_user and not is_deleted)
  )
$$;

drop function if exists public.indexable_profiles(int);
create function public.indexable_profiles(p_limit int default 50000)
returns table (username text, last_activity timestamptz)
language sql stable security definer set search_path = public as $$
  with activity as (
    select author_id, created_at from public.questions where not is_deleted and author_id is not null
    union all
    select author_id, created_at from public.answers where not is_deleted and author_id is not null
    union all
    select author_id, created_at from public.comments where not is_deleted and author_id is not null
  )
  select p.username, max(a.created_at)
    from activity a
    join public.profiles p on p.id = a.author_id
   where not (p.is_banned and (p.banned_until is null or p.banned_until > now()))
   group by p.id, p.username
   order by max(a.created_at) desc
   limit least(greatest(coalesce(p_limit, 50000), 1), 50000)
$$;

-- Thread is indexable: visible and its author is not banned.
create or replace function public.thread_is_indexable(p_question_id bigint)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select not q.is_deleted and (q.author_id is null or not public.user_is_banned(q.author_id))
      from public.questions q where q.id = p_question_id
  ), false)
$$;

revoke execute on function public.user_is_banned(uuid) from public, anon, authenticated;
revoke execute on function public.indexable_profiles(int) from public, anon, authenticated;
revoke execute on function public.thread_is_indexable(bigint) from public, anon, authenticated;
grant execute on function public.user_is_banned(uuid) to anon, authenticated;
grant execute on function public.profile_is_indexable(uuid) to anon, authenticated;
grant execute on function public.indexable_profiles(int) to anon, authenticated;
grant execute on function public.thread_is_indexable(bigint) to anon, authenticated;
