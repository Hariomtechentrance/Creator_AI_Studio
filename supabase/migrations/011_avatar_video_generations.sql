-- Allow the "avatar_video" generation type (AI Avatar Studio — HeyGen-backed
-- talking-avatar spokesperson videos), alongside image/video/upscale/texture.
alter table public.generations drop constraint generations_type_check;
alter table public.generations add constraint generations_type_check
  check (type in ('image', 'video', 'upscale', 'texture', 'avatar_video'));
