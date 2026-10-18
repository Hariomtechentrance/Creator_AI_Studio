-- AI Video Pipeline: scene-script generation, HeyGen custom-face asset
-- registration, and ffmpeg scene stitching are new credit-metered
-- generation types, alongside image/video/upscale/texture/avatar_video.
alter table public.generations drop constraint generations_type_check;
alter table public.generations add constraint generations_type_check
  check (type in ('image', 'video', 'upscale', 'texture', 'avatar_video', 'scene_script', 'custom_avatar', 'video_stitch'));

-- Public bucket for final stitched video posts. Facebook/Instagram/LinkedIn
-- fetch this URL themselves at publish time, which can happen after a delay
-- for human review, so (unlike the transient Replicate/HeyGen URLs used as
-- stitch inputs) the final result needs a durable, public home.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('content-media', 'content-media', true, 104857600, array['video/mp4'])
on conflict (id) do nothing;

-- Path convention `${orgId}/${filename}` — any org member can upload/delete,
-- anyone can read (bucket is public; publish-time fetchers need no auth),
-- matching brand-logos' pattern in 009_storage_buckets.sql.
create policy "org_members_upload_content_media" on storage.objects for insert
  with check (
    bucket_id = 'content-media'
    and is_org_member((storage.foldername(name))[1]::uuid)
  );

create policy "org_members_delete_content_media" on storage.objects for delete
  using (
    bucket_id = 'content-media'
    and is_org_member((storage.foldername(name))[1]::uuid)
  );

create policy "public_read_content_media" on storage.objects for select
  using (bucket_id = 'content-media');
