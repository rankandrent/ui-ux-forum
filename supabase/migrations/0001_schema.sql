-- forum.ui-ux.agency — core schema
-- Run order: 0001 → 0002 → 0003 → 0004 (Supabase SQL Editor, one file at a time).

-- ---------------------------------------------------------------------------
-- Profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  username      text not null unique
                check (username ~ '^[a-z0-9_]{3,30}$'),
  display_name  text not null check (char_length(display_name) between 1 and 60),
  bio           text not null default '' check (char_length(bio) <= 1000),
  website       text check (website is null or website ~* '^https?://'),
  avatar_url    text check (avatar_url is null or avatar_url ~* '^https://'),
  reputation    integer not null default 1,
  role          text not null default 'user' check (role in ('user', 'moderator', 'admin')),
  is_banned     boolean not null default false,
  banned_until  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Categories & tags
-- ---------------------------------------------------------------------------
create table public.categories (
  id           smallint generated always as identity primary key,
  slug         text not null unique check (slug ~ '^[a-z0-9-]{2,40}$'),
  name         text not null,
  description  text not null default '',
  sort_order   smallint not null default 0
);

create table public.tags (
  id              integer generated always as identity primary key,
  slug            text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{0,29}$'),
  question_count  integer not null default 0,
  created_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Questions, answers, comments
-- ---------------------------------------------------------------------------
create table public.questions (
  id                  bigint generated always as identity primary key,
  author_id           uuid references public.profiles (id) on delete set null,
  category_id         smallint not null references public.categories (id),
  title               text not null check (char_length(title) between 15 and 150),
  slug                text not null,
  body                text not null check (char_length(body) between 30 and 20000),
  image_url           text check (image_url is null or image_url ~* '^https://'),
  score               integer not null default 0,
  answer_count        integer not null default 0,
  comment_count       integer not null default 0,
  view_count          integer not null default 0,
  accepted_answer_id  bigint,
  is_locked           boolean not null default false,
  is_deleted          boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  last_activity_at    timestamptz not null default now(),
  search_vector       tsvector generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(body, '')), 'B')
  ) stored
);

create index questions_created_idx      on public.questions (created_at desc) where not is_deleted;
create index questions_activity_idx     on public.questions (last_activity_at desc) where not is_deleted;
create index questions_score_idx        on public.questions (score desc, created_at desc) where not is_deleted;
create index questions_unanswered_idx   on public.questions (created_at desc) where not is_deleted and answer_count = 0;
create index questions_category_idx     on public.questions (category_id, created_at desc);
create index questions_author_idx       on public.questions (author_id, created_at desc);
create index questions_search_idx       on public.questions using gin (search_vector);

create table public.question_tags (
  question_id  bigint not null references public.questions (id) on delete cascade,
  tag_id       integer not null references public.tags (id) on delete cascade,
  primary key (question_id, tag_id)
);
create index question_tags_tag_idx on public.question_tags (tag_id);

create table public.answers (
  id           bigint generated always as identity primary key,
  question_id  bigint not null references public.questions (id) on delete cascade,
  author_id    uuid references public.profiles (id) on delete set null,
  body         text not null check (char_length(body) between 30 and 20000),
  score        integer not null default 0,
  is_accepted  boolean not null default false,
  is_deleted   boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index answers_question_idx on public.answers (question_id, created_at);
create index answers_author_idx   on public.answers (author_id, created_at desc);

alter table public.questions
  add constraint questions_accepted_answer_fk
  foreign key (accepted_answer_id) references public.answers (id) on delete set null;

create table public.comments (
  id           bigint generated always as identity primary key,
  author_id    uuid references public.profiles (id) on delete set null,
  question_id  bigint references public.questions (id) on delete cascade,
  answer_id    bigint references public.answers (id) on delete cascade,
  body         text not null check (char_length(body) between 5 and 1000),
  is_deleted   boolean not null default false,
  created_at   timestamptz not null default now(),
  check (num_nonnulls(question_id, answer_id) = 1)
);
create index comments_question_idx on public.comments (question_id, created_at);
create index comments_answer_idx   on public.comments (answer_id, created_at);
create index comments_author_idx   on public.comments (author_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Votes
-- ---------------------------------------------------------------------------
create table public.question_votes (
  user_id      uuid not null references public.profiles (id) on delete cascade,
  question_id  bigint not null references public.questions (id) on delete cascade,
  value        smallint not null check (value in (-1, 1)),
  created_at   timestamptz not null default now(),
  primary key (user_id, question_id)
);
create index question_votes_question_idx on public.question_votes (question_id);

create table public.answer_votes (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  answer_id  bigint not null references public.answers (id) on delete cascade,
  value      smallint not null check (value in (-1, 1)),
  created_at timestamptz not null default now(),
  primary key (user_id, answer_id)
);
create index answer_votes_answer_idx on public.answer_votes (answer_id);

-- ---------------------------------------------------------------------------
-- Reputation ledger (source of truth for profiles.reputation)
-- ---------------------------------------------------------------------------
create table public.reputation_events (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  delta       integer not null,
  reason      text not null,
  source_key  text not null unique, -- idempotency key, e.g. 'qvote:<qid>:<voter>'
  created_at  timestamptz not null default now()
);
create index reputation_events_user_idx on public.reputation_events (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Badges
-- ---------------------------------------------------------------------------
create table public.badges (
  slug         text primary key,
  name         text not null,
  description  text not null,
  tier         text not null default 'bronze' check (tier in ('bronze', 'silver', 'gold'))
);

create table public.user_badges (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  badge_slug  text not null references public.badges (slug) on delete cascade,
  awarded_at  timestamptz not null default now(),
  primary key (user_id, badge_slug)
);

-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------
create table public.notifications (
  id           bigint generated always as identity primary key,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  actor_id     uuid references public.profiles (id) on delete set null,
  type         text not null check (type in ('answer', 'comment', 'accepted', 'badge', 'moderation')),
  question_id  bigint references public.questions (id) on delete cascade,
  answer_id    bigint references public.answers (id) on delete cascade,
  comment_id   bigint references public.comments (id) on delete cascade,
  message      text,
  read_at      timestamptz,
  emailed_at   timestamptz,
  created_at   timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id) where read_at is null;

-- ---------------------------------------------------------------------------
-- Reports & moderation log
-- ---------------------------------------------------------------------------
create table public.reports (
  id           bigint generated always as identity primary key,
  reporter_id  uuid references public.profiles (id) on delete set null,
  target_type  text not null check (target_type in ('question', 'answer', 'comment', 'user')),
  target_id    text not null,
  reason       text not null check (reason in ('spam', 'offensive', 'off_topic', 'low_quality', 'other')),
  details      text not null default '' check (char_length(details) <= 500),
  status       text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  resolved_by  uuid references public.profiles (id) on delete set null,
  resolved_at  timestamptz,
  created_at   timestamptz not null default now(),
  unique (reporter_id, target_type, target_id)
);
create index reports_status_idx on public.reports (status, created_at desc);

create table public.moderation_log (
  id            bigint generated always as identity primary key,
  moderator_id  uuid references public.profiles (id) on delete set null,
  action        text not null,
  target_type   text not null,
  target_id     text not null,
  note          text,
  created_at    timestamptz not null default now()
);
create index moderation_log_created_idx on public.moderation_log (created_at desc);
