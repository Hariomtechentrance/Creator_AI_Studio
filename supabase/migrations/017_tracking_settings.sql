-- Performance-marketing tracking setup (GTM/GA4/Meta Pixel). These power
-- the tracking snippets injected into published landing pages
-- (src/app/lp/[slug]) and the server-side Lead conversion events fired
-- from /api/public/lead-capture. Same column-lockdown pattern as
-- white_label in 008_white_label.sql — added to organizations, deliberately
-- left out of the authenticated update grant from
-- 005_brand_profile_and_org_lockdown.sql, so writes go through
-- /api/org/tracking-settings after an owner/admin role check, not direct
-- client writes (ga4_api_secret in particular shouldn't be client-writable).

alter table organizations add column if not exists gtm_container_id text;
alter table organizations add column if not exists ga4_measurement_id text;
alter table organizations add column if not exists ga4_api_secret text;
alter table organizations add column if not exists meta_pixel_id text;
