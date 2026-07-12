-- `automations` had RLS enabled in 002_growth_os.sql but no policy (same
-- gap pattern as org_members/organizations before 004/005) — nobody could
-- use it. `automation_logs` never had RLS enabled at all, which would have
-- left it world-readable/writable to any authenticated user once used.

create policy "org_access_automations" on automations for all
  using (is_org_member(org_id));

alter table automation_logs enable row level security;

create policy "org_access_automation_logs" on automation_logs for all
  using (is_org_member(org_id));
