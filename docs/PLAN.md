# forum.ui-ux.agency — build plan

Q&A forum for UI/UX design questions, owned by [ui-ux.agency](https://ui-ux.agency).
Stack: Next.js 16 (App Router, TypeScript) on Cloudflare Workers via OpenNext · Supabase (Postgres + Auth) ·
Cloudflare R2 (images) · Cloudflare Turnstile (spam) · Resend (email). Everything stays on free tiers.

## Phase 1 — core forum ✅

- [x] Schema migrations (`supabase/migrations/0001–0004`): profiles, categories, tags, questions, answers,
      comments, votes, reputation ledger, badges, notifications, reports, moderation log.
- [x] Row Level Security on every table. Clients can only `SELECT`; all writes go through
      `SECURITY DEFINER` functions that check sign-in, bans, locks and rate limits.
      The only direct write is a user editing safe columns of their own profile (column grants).
- [x] Rate limits for new users (account < 3 days or reputation < 50): 3 questions, 10 answers,
      20 comments, 40 votes per day, and 60 s between posts.
- [x] Reputation (question vote +5/−2, answer vote +10/−2, accepted +15, accepting +2) and basic badges.
- [x] Seed: 7 categories + badge definitions only (no users or posts).
- [x] Auth: email + password, magic link, Google (Supabase Auth, `@supabase/ssr`, PKCE callback).
- [x] Profiles: name, username, bio, website; avatar from Google (upload comes in phase 2).
- [x] Ask (title, markdown body, category, 1–5 tags), edit, delete.
- [x] Answers, comments, up/down votes, accept best answer.
- [x] Category pages, tag pages, tag index, sort latest/top/unanswered, pagination.
- [x] Basic Postgres full-text search page (`/search/?q=`).
- [x] Safe markdown (raw HTML disabled, `rel="ugc nofollow"` on user links, https-only images).
- [x] Clean URLs `/q/<id>-<slug>/` with a permanent redirect to the canonical slug; per-page metadata;
      `noindex` on unanswered threads, profiles, auth and filtered list pages.
- [x] Cloudflare Workers config (`wrangler.jsonc`, `open-next.config.ts`).

## Phase 2 — growth & safety

- [ ] Image upload for questions and avatars → R2 (`FORUM_IMAGES` binding), size/type checks.
- [ ] Turnstile on signup and posting (questions, answers, comments).
- [ ] Notifications UI (bell + list, mark read); email via Resend when `RESEND_API_KEY` exists.
- [ ] Report button UI on questions, answers, comments and users.
- [ ] Moderator/admin panel: reports queue, delete/restore, lock/unlock, ban/unban, edit, moderation log
      (new migration with `mod_*` functions).
- [ ] Search improvements: ranking (`ts_rank`), category/tag filters.
- [ ] SEO: `QAPage` JSON-LD, `sitemap.xml` (only threads with ≥ 1 answer), `robots.txt`,
      related ui-ux.agency blog/service links per thread (category/tag mapping), Open Graph image.

## Phase 3 — polish & launch

- [ ] Unit tests (markdown sanitizing, slug/URL helpers) and SQL tests for RLS/RPCs.
- [ ] Accessibility and mobile pass, loading/empty states, user menu.
- [ ] Password reset, account deletion.
- [ ] Deploy docs: Cloudflare Worker + `forum.ui-ux.agency` custom domain, secrets, R2 bucket,
      Supabase auth URLs, Google OAuth, Resend domain.
