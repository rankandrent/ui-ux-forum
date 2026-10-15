-- forum.ui-ux.agency — Row Level Security.
-- Every table has RLS enabled. Clients get SELECT where appropriate; all content
-- writes happen through the SECURITY DEFINER functions in 0002_functions.sql.
-- The only direct client write is a user updating safe columns of their own profile.

alter table public.profiles          enable row level security;
alter table public.categories        enable row level security;
alter table public.tags              enable row level security;
alter table public.questions         enable row level security;
alter table public.question_tags     enable row level security;
alter table public.answers           enable row level security;
alter table public.comments          enable row level security;
alter table public.question_votes    enable row level security;
alter table public.answer_votes      enable row level security;
alter table public.reputation_events enable row level security;
alter table public.badges            enable row level security;
alter table public.user_badges       enable row level security;
alter table public.notifications     enable row level security;
alter table public.reports           enable row level security;
alter table public.moderation_log    enable row level security;

-- Table privileges: read for everyone (RLS filters rows), no direct writes.
revoke all on all tables in schema public from anon, authenticated;
grant select on all tables in schema public to anon, authenticated;
revoke select on public.reputation_events, public.notifications, public.reports,
                 public.moderation_log, public.question_votes, public.answer_votes from anon;

-- Profile: users may edit only these columns of their own row.
grant update (username, display_name, bio, website, avatar_url) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- Policies
-- ---------------------------------------------------------------------------
create policy "profiles are public" on public.profiles
  for select using (true);
create policy "users update own profile" on public.profiles
  for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy "categories are public" on public.categories for select using (true);
create policy "tags are public"       on public.tags       for select using (true);
create policy "badges are public"     on public.badges     for select using (true);
create policy "user badges are public" on public.user_badges for select using (true);

create policy "visible questions" on public.questions
  for select using (not is_deleted or author_id = auth.uid() or public.is_staff());

create policy "question tags are public" on public.question_tags
  for select using (true);

create policy "visible answers" on public.answers
  for select using (not is_deleted or author_id = auth.uid() or public.is_staff());

create policy "visible comments" on public.comments
  for select using (not is_deleted or author_id = auth.uid() or public.is_staff());

create policy "own question votes" on public.question_votes
  for select to authenticated using (user_id = auth.uid());
create policy "own answer votes" on public.answer_votes
  for select to authenticated using (user_id = auth.uid());

create policy "own reputation events" on public.reputation_events
  for select to authenticated using (user_id = auth.uid());

create policy "own notifications" on public.notifications
  for select to authenticated using (user_id = auth.uid());

create policy "own or staff reports" on public.reports
  for select to authenticated using (reporter_id = auth.uid() or public.is_staff());

create policy "staff read moderation log" on public.moderation_log
  for select to authenticated using (public.is_staff());
