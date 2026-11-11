-- Content Studio's text generation was missing credit metering entirely —
-- no corresponding "content" value existed in generations_type_check, so
-- adding one now that the route actually logs/deducts credits like every
-- other generation type.
alter table public.generations drop constraint generations_type_check;
alter table public.generations add constraint generations_type_check
  check (type in ('image', 'video', 'upscale', 'texture', 'avatar_video', 'scene_script', 'custom_avatar', 'video_stitch', 'content'));
