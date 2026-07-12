-- ═══════════════════════════════════════════════════════════════
-- GROWTH OS — Complete Schema Migration
-- Run this in Supabase SQL Editor after 001_initial.sql
-- ═══════════════════════════════════════════════════════════════

-- ─── ORGANIZATIONS ──────────────────────────────────────────────
create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  industry text,
  industry_niche text,
  website text,
  logo_url text,
  description text,
  owner_id uuid references auth.users(id) on delete cascade,
  plan_tier text default 'free',
  onboarding_completed boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists org_members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role text default 'viewer',
  invited_by uuid references auth.users(id),
  joined_at timestamptz default now(),
  unique(org_id, user_id)
);

-- ─── BRAND INTELLIGENCE MODULE ──────────────────────────────────
create table if not exists brand_profiles (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade unique,
  business_type text,
  target_audience jsonb default '{}',
  tone_of_voice text default 'professional',
  brand_personality text[] default '{}',
  offerings jsonb default '[]',
  competitors jsonb default '[]',
  unique_selling_points text[] default '{}',
  pain_points_solved text[] default '{}',
  monthly_budget_range text,
  marketing_experience text default 'beginner',
  current_platforms text[] default '{}',
  past_campaigns jsonb default '[]',
  brand_colors text[] default '{}',
  brand_fonts text[] default '{}',
  approved_keywords text[] default '{}',
  banned_words text[] default '{}',
  ai_brand_summary text,
  ai_strategy jsonb default '{}',
  ai_last_analyzed_at timestamptz,
  primary_goal text default 'leads',
  monthly_targets jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ─── SOCIAL ACCOUNTS MODULE ─────────────────────────────────────
create table if not exists social_accounts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade,
  platform text not null,
  account_id text not null,
  account_name text,
  account_username text,
  account_avatar text,
  account_type text default 'business',
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  scopes text[] default '{}',
  is_active boolean default true,
  last_synced_at timestamptz,
  follower_count integer default 0,
  following_count integer default 0,
  post_count integer default 0,
  created_at timestamptz default now(),
  unique(org_id, platform, account_id)
);

-- ─── CONTENT CREATION & PUBLISHING MODULE ───────────────────────
create table if not exists content_posts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade,
  title text,
  caption text,
  hashtags text[] default '{}',
  keywords text[] default '{}',
  call_to_action text,
  media_type text default 'image',
  media_urls text[] default '{}',
  thumbnail_url text,
  platforms text[] default '{}',
  platform_versions jsonb default '{}',
  post_type text default 'organic',
  campaign_id uuid,
  ai_generated boolean default false,
  original_prompt text,
  ai_model_used text,
  ai_score integer default 0,
  status text default 'draft',
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  scheduled_at timestamptz,
  published_at timestamptz,
  platform_post_ids jsonb default '{}',
  performance jsonb default '{}',
  performance_last_synced timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists content_calendar (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade,
  year integer not null,
  month integer not null,
  week integer,
  ai_plan jsonb default '{}',
  themes text[] default '{}',
  status text default 'draft',
  created_at timestamptz default now(),
  unique(org_id, year, month)
);

-- ─── LEADS / CRM MODULE ─────────────────────────────────────────
create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade,
  name text,
  email text,
  phone text,
  location text,
  company text,
  source text default 'manual',
  source_post_id uuid references content_posts(id) on delete set null,
  source_campaign_id uuid,
  source_url text,
  utm_data jsonb default '{}',
  status text default 'new',
  pipeline_stage_entered_at jsonb default '{}',
  ai_score integer default 0,
  ai_score_reason text,
  ai_insights jsonb default '{}',
  ai_last_analyzed_at timestamptz,
  assigned_to uuid references auth.users(id),
  assigned_at timestamptz,
  tags text[] default '{}',
  priority text default 'medium',
  preferred_channel text,
  do_not_contact boolean default false,
  best_contact_time text,
  estimated_value numeric default 0,
  converted_value numeric,
  converted_at timestamptz,
  lost_reason text,
  custom_fields jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists lead_notes (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete cascade,
  org_id uuid references organizations(id) on delete cascade,
  content text not null,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

create table if not exists lead_activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete cascade,
  org_id uuid references organizations(id) on delete cascade,
  type text not null,
  direction text default 'outbound',
  content text,
  media_url text,
  ai_generated boolean default false,
  sentiment text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade,
  lead_id uuid references leads(id) on delete set null,
  title text not null,
  description text,
  type text default 'follow_up',
  status text default 'pending',
  priority text default 'medium',
  assigned_to uuid references auth.users(id),
  due_at timestamptz,
  completed_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

-- ─── COMMUNITY MANAGER MODULE ───────────────────────────────────
create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade,
  lead_id uuid references leads(id) on delete set null,
  social_account_id uuid references social_accounts(id) on delete set null,
  platform text not null,
  external_id text,
  external_user_id text,
  external_username text,
  external_avatar text,
  status text default 'open',
  handled_by text default 'bot',
  assigned_to uuid references auth.users(id),
  post_id uuid references content_posts(id) on delete set null,
  sentiment text,
  intent text,
  ai_context jsonb default '{}',
  ai_last_replied_at timestamptz,
  escalation_reason text,
  last_message_at timestamptz default now(),
  created_at timestamptz default now()
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references conversations(id) on delete cascade,
  org_id uuid references organizations(id) on delete cascade,
  sender_type text not null,
  sender_id text,
  content text,
  media_urls text[] default '{}',
  media_type text default 'text',
  ai_generated boolean default false,
  ai_confidence float,
  sentiment text,
  intent_detected text,
  external_message_id text,
  is_read boolean default false,
  delivered_at timestamptz,
  read_at timestamptz,
  created_at timestamptz default now()
);

-- ─── AUTOMATION ENGINE ──────────────────────────────────────────
create table if not exists automations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade,
  name text not null,
  description text,
  trigger_type text not null,
  trigger_config jsonb default '{}',
  conditions jsonb default '[]',
  actions jsonb default '[]',
  is_active boolean default true,
  run_count integer default 0,
  last_run_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

create table if not exists automation_logs (
  id uuid primary key default gen_random_uuid(),
  automation_id uuid references automations(id) on delete cascade,
  org_id uuid references organizations(id) on delete cascade,
  lead_id uuid references leads(id) on delete set null,
  status text,
  actions_executed jsonb default '[]',
  error text,
  executed_at timestamptz default now()
);

-- ─── CAMPAIGNS ──────────────────────────────────────────────────
create table if not exists campaigns (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade,
  name text not null,
  type text default 'content',
  goal text default 'awareness',
  status text default 'draft',
  platforms text[] default '{}',
  budget numeric default 0,
  budget_spent numeric default 0,
  target_audience jsonb default '{}',
  ai_strategy text,
  start_date date,
  end_date date,
  performance jsonb default '{}',
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

-- ─── ANALYTICS MODULE ───────────────────────────────────────────
create table if not exists analytics_snapshots (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade,
  snapshot_date date not null,
  platform text default 'overall',
  posts_published integer default 0,
  total_reach bigint default 0,
  total_impressions bigint default 0,
  total_engagement bigint default 0,
  total_likes integer default 0,
  total_comments integer default 0,
  total_shares integer default 0,
  total_saves integer default 0,
  new_followers integer default 0,
  leads_generated integer default 0,
  leads_converted integer default 0,
  conversations_started integer default 0,
  revenue_attributed numeric default 0,
  cost_per_lead numeric,
  conversion_rate numeric,
  raw_data jsonb default '{}',
  created_at timestamptz default now(),
  unique(org_id, snapshot_date, platform)
);

create table if not exists ai_reports (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade,
  report_type text default 'weekly',
  period_start date,
  period_end date,
  insights jsonb default '[]',
  recommendations jsonb default '[]',
  red_flags jsonb default '[]',
  opportunities jsonb default '[]',
  generated_by text default 'ai',
  created_at timestamptz default now()
);

-- ─── NOTIFICATIONS ──────────────────────────────────────────────
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  data jsonb default '{}',
  is_read boolean default false,
  created_at timestamptz default now()
);

-- ─── PERFORMANCE INDEXES ────────────────────────────────────────
create index if not exists idx_leads_org_status on leads(org_id, status);
create index if not exists idx_leads_org_score on leads(org_id, ai_score desc);
create index if not exists idx_leads_assigned on leads(assigned_to, status);
create index if not exists idx_content_posts_org_status on content_posts(org_id, status);
create index if not exists idx_content_posts_scheduled on content_posts(scheduled_at) where status = 'scheduled';
create index if not exists idx_conversations_org_status on conversations(org_id, status);
create index if not exists idx_messages_conversation on messages(conversation_id, created_at);
create index if not exists idx_analytics_org_date on analytics_snapshots(org_id, snapshot_date desc);
create index if not exists idx_notifications_unread on notifications(user_id, is_read) where is_read = false;
create index if not exists idx_tasks_due on tasks(org_id, due_at, status);

-- ─── ROW LEVEL SECURITY ─────────────────────────────────────────
alter table organizations enable row level security;
alter table org_members enable row level security;
alter table brand_profiles enable row level security;
alter table social_accounts enable row level security;
alter table content_posts enable row level security;
alter table content_calendar enable row level security;
alter table leads enable row level security;
alter table lead_notes enable row level security;
alter table lead_activities enable row level security;
alter table tasks enable row level security;
alter table conversations enable row level security;
alter table messages enable row level security;
alter table automations enable row level security;
alter table campaigns enable row level security;
alter table analytics_snapshots enable row level security;
alter table ai_reports enable row level security;
alter table notifications enable row level security;

-- Helper: is the current user a member of this org?
create or replace function is_org_member(p_org_id uuid)
returns boolean language sql security definer as $$
  select exists (
    select 1 from org_members
    where org_id = p_org_id and user_id = auth.uid()
  ) or exists (
    select 1 from organizations
    where id = p_org_id and owner_id = auth.uid()
  );
$$;

-- Apply the same policy pattern to all org-scoped tables
create policy "org_access_organizations" on organizations for all
  using (owner_id = auth.uid() or is_org_member(id));

create policy "org_access_brand_profiles" on brand_profiles for all
  using (is_org_member(org_id));

create policy "org_access_social_accounts" on social_accounts for all
  using (is_org_member(org_id));

create policy "org_access_content_posts" on content_posts for all
  using (is_org_member(org_id));

create policy "org_access_leads" on leads for all
  using (is_org_member(org_id));

create policy "org_access_lead_notes" on lead_notes for all
  using (is_org_member(org_id));

create policy "org_access_lead_activities" on lead_activities for all
  using (is_org_member(org_id));

create policy "org_access_tasks" on tasks for all
  using (is_org_member(org_id));

create policy "org_access_conversations" on conversations for all
  using (is_org_member(org_id));

create policy "org_access_messages" on messages for all
  using (is_org_member(org_id));

create policy "org_access_campaigns" on campaigns for all
  using (is_org_member(org_id));

create policy "org_access_analytics" on analytics_snapshots for all
  using (is_org_member(org_id));

create policy "org_access_ai_reports" on ai_reports for all
  using (is_org_member(org_id));

create policy "own_notifications" on notifications for all
  using (user_id = auth.uid());
