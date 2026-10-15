-- forum.ui-ux.agency — SEO helpers: public vote tallies (up/down, aggregated) and indexable profiles.
-- Individual votes stay private (RLS); only totals are exposed.

create or replace function public.thread_vote_tallies(p_question_id bigint)
returns table (target_type text, target_id bigint, ups int, downs int)
language sql stable security definer set search_path = public as $$
  select 'question', p_question_id,
         count(*) filter (where value = 1)::int, count(*) filter (where value = -1)::int
    from public.question_votes where question_id = p_question_id
  union all
  select 'answer', a.id,
         count(v.*) filter (where v.value = 1)::int, count(v.*) filter (where v.value = -1)::int
    from public.answers a
    left join public.answer_votes v on v.answer_id = a.id
   where a.question_id = p_question_id and not a.is_deleted
   group by a.id
$$;

-- A profile is worth indexing once its owner has helped: 3+ upvoted answers or an accepted answer.
create or replace function public.profile_is_indexable(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select count(*) filter (where score >= 1) >= 3 or bool_or(is_accepted)
      from public.answers where author_id = p_user and not is_deleted
  ), false)
$$;

create or replace function public.indexable_profiles(p_limit int default 50000)
returns table (username text, last_activity timestamptz)
language sql stable security definer set search_path = public as $$
  select p.username, max(a.created_at)
    from public.profiles p
    join public.answers a on a.author_id = p.id and not a.is_deleted
   where not (p.is_banned and (p.banned_until is null or p.banned_until > now()))
   group by p.id, p.username
  having count(*) filter (where a.score >= 1) >= 3 or bool_or(a.is_accepted)
   order by max(a.created_at) desc
   limit least(greatest(coalesce(p_limit, 50000), 1), 50000)
$$;

revoke execute on function public.thread_vote_tallies(bigint) from public, anon, authenticated;
revoke execute on function public.profile_is_indexable(uuid) from public, anon, authenticated;
revoke execute on function public.indexable_profiles(int) from public, anon, authenticated;
grant execute on function public.thread_vote_tallies(bigint) to anon, authenticated;
grant execute on function public.profile_is_indexable(uuid) to anon, authenticated;
grant execute on function public.indexable_profiles(int) to anon, authenticated;
