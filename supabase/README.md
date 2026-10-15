# Supabase setup

All database and Auth setup runs from scripts through the Supabase Management API — nothing needs to be
pasted into the dashboard. Required environment variables (names only, never commit values):
`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ACCESS_TOKEN` (personal access
token, `sbp_…`). The project ref is the subdomain of `SUPABASE_URL`.

## 1. Migrations

```bash
npm run db:migrate -- --status   # list applied / pending files
npm run db:migrate               # apply pending files in order
```

`scripts/db-migrate.mjs` applies `migrations/*.sql` in filename order. Each file runs in one transaction
together with its row in `forum_meta.migrations` (name + sha256), so re-running only applies new files.
Never edit an applied migration — the runner refuses changed files; add `0005_….sql` instead.

## 2. Auth settings

```bash
npm run db:auth-config
```

Sets Site URL `https://forum.ui-ux.agency` and redirect URLs `https://forum.ui-ux.agency/auth/callback/**`
and `http://localhost:3000/auth/callback/**`. Email sign-in stays on with "Confirm email".

Google login stays off until a Google Cloud OAuth client exists (authorized redirect URI
`https://<project-ref>.supabase.co/auth/v1/callback`); then enable the Google provider with its Client ID
and Secret.

## 3. Storage & backups

`0006_storage.sql` creates the public `forum-images` bucket (1 MB, images only, own-folder uploads by signed-in,
non-banned users) and the private `backups` bucket. `npm run db:backup` saves a gzipped JSON dump of all tables
to `backups/db/` and keeps the newest 14.

## 4. Checks

```bash
npm run db:verify   # tables reachable, anon cannot call write RPCs
npm run db:e2e      # real ask/answer/vote/accept/comment/notification/report flow with two temporary
                    # users; deletes every row it created and both users, fails if anything is left
```

## 5. Make yourself admin (after signing up once)

```sql
update public.profiles set role = 'admin' where username = '<your-username>';
```
