-- Storage buckets for Brand Kit logo uploads and model-training images.
-- Both were previously blocked ("paste a URL" / "training disabled") for
-- lack of a configured bucket — this adds one of each with RLS-equivalent
-- storage policies (Supabase Storage authorizes via policies on
-- storage.objects, scoped by the org/user id encoded in the object path).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('brand-logos', 'brand-logos', true, 5242880, array['image/png','image/jpeg','image/webp','image/svg+xml'])
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('training-images', 'training-images', false, 10485760, array['image/png','image/jpeg','image/webp'])
on conflict (id) do nothing;

-- brand-logos: path convention `${orgId}/${filename}` — any org member can
-- upload/replace, anyone can read (bucket is public, used in <img> tags).
create policy "org_members_upload_logo" on storage.objects for insert
  with check (
    bucket_id = 'brand-logos'
    and is_org_member((storage.foldername(name))[1]::uuid)
  );

create policy "org_members_update_logo" on storage.objects for update
  using (
    bucket_id = 'brand-logos'
    and is_org_member((storage.foldername(name))[1]::uuid)
  );

create policy "org_members_delete_logo" on storage.objects for delete
  using (
    bucket_id = 'brand-logos'
    and is_org_member((storage.foldername(name))[1]::uuid)
  );

create policy "public_read_logo" on storage.objects for select
  using (bucket_id = 'brand-logos');

-- training-images: path convention `${userId}/${modelId}/${filename}` —
-- only the uploading user can read/write their own training images
-- (matches trained_models' user_id-scoped RLS in 001_initial.sql).
create policy "owner_upload_training_image" on storage.objects for insert
  with check (
    bucket_id = 'training-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "owner_read_training_image" on storage.objects for select
  using (
    bucket_id = 'training-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "owner_delete_training_image" on storage.objects for delete
  using (
    bucket_id = 'training-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
