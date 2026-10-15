# Deploying forum.ui-ux.agency (Cloudflare Workers)

Run from the repo root with `CLOUDFLARE_API_TOKEN` (Workers Scripts edit, Workers R2 edit, Zone → Workers Routes
edit for ui-ux.agency) and `CLOUDFLARE_ACCOUNT_ID` if the token can see more than one account.
Never paste secret values into files — `wrangler secret put` reads them from stdin.

## 1. One-time setup

```bash
npx wrangler whoami                                   # token works, right account
npx wrangler r2 bucket create ui-ux-forum-images      # bucket bound as FORUM_IMAGES

# Worker secrets (values come from the environment, never echoed)
for name in SUPABASE_URL SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY; do
  printf '%s' "${!name}" | npx wrangler secret put "$name"
done
# Optional, once they exist:
#   TURNSTILE_SITE_KEY, TURNSTILE_SECRET_KEY  (Turnstile widget for forum.ui-ux.agency)
#   RESEND_API_KEY, EMAIL_FROM                (after verifying the sending domain in Resend)
#   GOOGLE_AUTH_ENABLED=true                  (after the Google provider is configured in Supabase)
```

Supabase Auth URLs: `npm run db:auth-config` (Site URL + `/auth/callback/**` redirect URLs).

## 2. Deploy

```bash
npm run check        # lint + typecheck + next build
npm run deploy       # opennextjs-cloudflare build + deploy (Worker + custom domain forum.ui-ux.agency)
```

`wrangler.jsonc` attaches the custom domain `forum.ui-ux.agency`; the `ui-ux.agency` zone must be on the same
Cloudflare account. Cloudflare creates the DNS record and certificate automatically.

## 3. After deploy

```bash
curl -sI https://forum.ui-ux.agency/ | head -1        # 200
curl -s  https://forum.ui-ux.agency/robots.txt
curl -s  https://forum.ui-ux.agency/sitemap.xml | head
```

- Sign up once on the live site, then make that account admin:
  `update public.profiles set role = 'admin' where username = '<username>';` (run through the Management API).
- Submit `https://forum.ui-ux.agency/sitemap.xml` in Google Search Console.

## Rollback

`npx wrangler deployments list` then `npx wrangler rollback <deployment-id>`.
