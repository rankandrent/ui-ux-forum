# forum.ui-ux.agency — build plan

Q&A forum for UI/UX design questions, owned by [ui-ux.agency](https://ui-ux.agency).
Stack: Next.js 16 (App Router, TypeScript) on Cloudflare Workers via OpenNext · Supabase (Postgres + Auth) ·
Supabase Storage (images) · Cloudflare Turnstile (spam) · Resend (email). Everything stays on free tiers.

**Rule: no-card free tiers only.** Any service or add-on that needs a payment method on file (e.g. Cloudflare R2,
Workers Paid, Supabase Pro) is out of scope. Current stack: Cloudflare Workers Free + Turnstile, Supabase Free
(DB, Auth, 1 GB Storage), Resend Free.

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

## Phase 2 — growth & safety ✅

- [x] Supabase setup runs from scripts via the Management API: `npm run db:migrate` (idempotent, logged in
      `forum_meta.migrations`), `npm run db:auth-config`, `npm run db:verify`, `npm run db:e2e`.
- [x] Image upload for questions/answers ("Add image" in the editor) and avatars (settings) → Supabase Storage
      public bucket `forum-images` (`0006_storage.sql`). Browser resizes to 1600 px (avatars 512 px) and encodes
      WebP/JPEG under 1 MB; server sniffs the type from bytes; storage policy allows uploads only by signed-in,
      non-banned users into their own folder; daily cap via `record_upload()` (10 new users / 50 others).
      Storage code is isolated in `src/lib/images.ts`.
- [x] Reddit-style rich text editor (Tiptap, loaded on demand) for questions and answers: toolbar (bold,
      italic, strike, heading, lists, quote, code, code block, link, image, undo/redo), Ctrl/Cmd+B/I/K, paste and
      drag-drop image upload, character counter, Markdown mode toggle. Still stores markdown.
- [x] Backups: `npm run db:backup` → private `backups` bucket (gzipped JSON of all tables, newest 14 kept).
- [x] Turnstile on signup and on questions, answers and comments for users under 50 reputation
      (skipped until `TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY` are set).
- [x] Notifications: header bell with unread count, `/notifications/` list, open = mark read, mark all read.
      Emails via Resend when `RESEND_API_KEY` exists; users can turn emails off in settings.
- [x] Report button on questions, answers, comments and user profiles (`create_report` checks the target exists).
- [x] Moderator/admin panel `/mod/`: reports queue (resolve/dismiss/reopen, delete, lock, manage author),
      deleted posts with restore, users (ban 1/7/30 days or permanent, unban, roles for admins), moderation log.
      Lock/unlock and restore also on thread pages. Migration `0005_phase2.sql` (`mod_*` functions).
- [x] Search: `search_questions()` with `ts_rank_cd` (boosted by score/answers) and category/tag filters.
- [x] SEO: `QAPage` JSON-LD on threads with answers, `sitemap.xml` (threads with ≥ 1 answer, categories,
      tags with ≥ 3 questions), `robots.txt`.
- [x] Forum SEO pass: QAPage (full text, net upvoteCount + Like/Dislike InteractionCounter, comments, dates,
      author image), ProfilePage on profiles (indexed after 3 upvoted answers or 1 accepted), WebSite +
      Organization, BreadcrumbList, CollectionPage/ItemList on categories and tags; explicit robots +
      max-image-preview:large; branded og:image + summary_large_image; self-canonical pagination, noindex sort
      variants and empty listings, 404 past the last page; sitemap index (threads/categories/tags/users with
      lastmod); robots.txt without Host and without blocking noindex pages; IndexNow ping on first answer.
      No Review/AggregateRating markup (self-serving reviews are against Google's guidelines).
- [ ] Related ui-ux.agency blog/service links per thread — needs the list of agency URLs per category/tag.
- [ ] Open Graph image — deferred (keeps the Worker bundle small).
- [ ] Google login — needs a Google Cloud OAuth client; then set `GOOGLE_AUTH_ENABLED=true`.

**Status (2026-10-15):** live at https://forum.ui-ux.agency (Worker `ui-ux-forum`, Workers Free). Supabase migrations
0001–0006 applied, Auth URLs set, end-to-end browser test passed on production and cleaned up.
Notification emails on (Resend, no-reply@forum.ui-ux.agency). Pending: Turnstile widget + keys, Google OAuth client.

## Phase 3 — polish & launch

- [ ] Unit tests (markdown sanitizing, slug/URL helpers) and SQL tests for RLS/RPCs.
- [ ] Accessibility and mobile pass, loading/empty states, user menu.
- [ ] Password reset, account deletion.
- [ ] Deploy docs: Cloudflare Worker + `forum.ui-ux.agency` custom domain, secrets, R2 bucket,
      Supabase auth URLs, Google OAuth, Resend domain.
