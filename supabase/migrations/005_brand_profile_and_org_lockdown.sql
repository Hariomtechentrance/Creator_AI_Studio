-- organizations' original policy was a single blanket "for all" using
-- is_org_member(id), meaning any member (even a 'viewer') could delete the
-- entire organization, cascading through every org-scoped table. Split into
-- select/update (unchanged — any member) and delete (owner only).
drop policy if exists "org_access_organizations" on organizations;

create policy "organizations_select" on organizations for select
  using (owner_id = auth.uid() or is_org_member(id));

create policy "organizations_update" on organizations for update
  using (owner_id = auth.uid() or is_org_member(id));

create policy "organizations_delete" on organizations for delete
  using (owner_id = auth.uid());

-- Column-grant lockdown, same pattern as the credits fix in
-- 003_lock_credit_columns.sql: members can edit business-profile fields,
-- but owner_id/plan_tier stay service-role-only.
revoke update on organizations from authenticated;
grant update (name, industry, industry_niche, website, logo_url, description, onboarding_completed)
  on organizations to authenticated;
