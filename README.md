# UI/UX Forum — forum.ui-ux.agency

Q&A community for UI/UX design questions (UX research, UI design, SaaS and AI products, design cost,
hiring designers, tools), run by [ui-ux.agency](https://ui-ux.agency).

- **App:** Next.js 16 (App Router, TypeScript), server-rendered on Cloudflare Workers via OpenNext.
- **Data & auth:** Supabase (Postgres + Auth). Schema, RLS and functions live in `supabase/migrations`.
- **Plan:** see [`docs/PLAN.md`](docs/PLAN.md).

## Local development

```bash
npm install
cp .env.example .env.local   # fill in SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
npm run dev                  # http://localhost:3000
```

Database setup: [`supabase/README.md`](supabase/README.md).

## Checks

```bash
npm run lint
npm run typecheck
npm run build        # Next.js build
npm run cf:build     # Cloudflare Worker bundle (.open-next/)
npm run preview      # run the Worker locally with wrangler
```

## Security notes

- Row Level Security is enabled on every table; clients only read. Writes go through
  `SECURITY DEFINER` SQL functions that enforce auth, bans, locks and rate limits.
- `SUPABASE_SERVICE_ROLE_KEY` is read only in `src/lib/supabase/admin.ts` (`server-only`).
- Markdown is rendered with raw HTML disabled; user links get `rel="ugc nofollow noopener"`.
- Never commit `.env*` files (only `.env.example`).
