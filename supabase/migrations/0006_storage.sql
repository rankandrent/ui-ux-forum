-- forum.ui-ux.agency — image storage in Supabase Storage (free tier; replaces Cloudflare R2).
-- forum-images: public read, uploads only by signed-in, non-banned users into their own folder:
--   q/<user-id>/<uuid>.<ext>        (question / answer images)
--   avatars/<user-id>/<uuid>.<ext>  (profile photos)
-- backups: private, service role only (scripts/db-backup.mjs).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('forum-images', 'forum-images', true, 1048576, array['image/webp', 'image/jpeg', 'image/png', 'image/gif'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public)
values ('backups', 'backups', false)
on conflict (id) do update set public = false;

-- Uploads: own folder only, not banned. No update/delete policies — objects are immutable for users.
create policy "forum images: upload to own folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'forum-images'
    and (storage.foldername(name))[1] in ('q', 'avatars')
    and (storage.foldername(name))[2] = auth.uid()::text
    and exists (
      select 1 from public.profiles p
       where p.id = auth.uid()
         and not (p.is_banned and (p.banned_until is null or p.banned_until > now()))
    )
  );
