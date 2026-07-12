-- Module 19: White Label System. Custom domains need real DNS/hosting
-- infrastructure this repo doesn't control, so that part isn't built —
-- this covers what's actually achievable: swapping the in-app name/logo
-- per organization (agency plan_tier feature).

alter table organizations add column if not exists white_label_enabled boolean default false;
alter table organizations add column if not exists white_label_name text;
