# Supabase setup

## 1. Run the migrations (SQL Editor)

Supabase dashboard → your project → **SQL Editor** → **New query**. Paste and run each file **in order**:

1. `migrations/0001_schema.sql`
2. `migrations/0002_functions.sql`
3. `migrations/0003_rls.sql`
4. `migrations/0004_seed.sql`

Each should finish with "Success. No rows returned".

## 2. Auth settings

**Authentication → URL Configuration**

- Site URL: `https://forum.ui-ux.agency`
- Redirect URLs: `https://forum.ui-ux.agency/auth/callback/**` and `http://localhost:3000/auth/callback/**`

**Authentication → Sign In / Providers**

- Email: enabled (keep "Confirm email" on).
- Google: enable and paste the Google OAuth Client ID + Secret. In Google Cloud Console the authorized
  redirect URI is `https://<project-ref>.supabase.co/auth/v1/callback`.

## 3. Make yourself admin (after signing up once)

```sql
update public.profiles set role = 'admin' where username = '<your-username>';
```
