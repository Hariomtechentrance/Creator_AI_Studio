-- content-media was created video-only (012_video_pipeline.sql), but content
-- posts can be images too (Product Reel photos, generated post graphics) —
-- not just video. Extend the existing bucket's allowed types instead of
-- creating a second bucket for the same conceptual thing.
update storage.buckets
set allowed_mime_types = array['video/mp4','image/png','image/jpeg','image/webp']
where id = 'content-media';
