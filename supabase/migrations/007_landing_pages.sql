-- Module 10: AI landing page builder. Public pages are served without auth
-- (via the service-role client, at src/app/lp/[slug]/page.tsx) so RLS here
-- only needs to cover the dashboard-side authoring flow.

create table if not exists landing_pages (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade,
  slug text not null unique,
  title text not null,
  headline text not null,
  subheadline text,
  sections jsonb default '[]',
  cta_text text default 'Get in touch',
  status text default 'draft',
  published_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_landing_pages_org on landing_pages(org_id);
create index if not exists idx_landing_pages_slug on landing_pages(slug);

alter table landing_pages enable row level security;

create policy "org_access_landing_pages" on landing_pages for all
  using (is_org_member(org_id));
