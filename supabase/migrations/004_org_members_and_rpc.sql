-- 002_growth_os.sql enabled RLS on org_members but never added policies,
-- which leaves it fully locked out (not even the owner could read team
-- membership). Add the missing policies using the same is_org_member() /
-- owner_id pattern already used on every other org-scoped table.

create policy "org_members_select" on org_members for select
  using (is_org_member(org_id));

create policy "org_members_insert" on org_members for insert
  with check (
    exists (select 1 from organizations o where o.id = org_id and o.owner_id = auth.uid())
    or exists (
      select 1 from org_members m
      where m.org_id = org_members.org_id and m.user_id = auth.uid() and m.role in ('owner', 'admin')
    )
  );

create policy "org_members_update" on org_members for update
  using (
    exists (select 1 from organizations o where o.id = org_id and o.owner_id = auth.uid())
    or exists (
      select 1 from org_members m
      where m.org_id = org_members.org_id and m.user_id = auth.uid() and m.role in ('owner', 'admin')
    )
  );

create policy "org_members_delete" on org_members for delete
  using (
    user_id = auth.uid()
    or exists (select 1 from organizations o where o.id = org_id and o.owner_id = auth.uid())
    or exists (
      select 1 from org_members m
      where m.org_id = org_members.org_id and m.user_id = auth.uid() and m.role in ('owner', 'admin')
    )
  );

-- Atomically create an organization and its owner membership row, scoped to
-- the calling user (auth.uid() resolves from the caller's JWT even inside a
-- security definer function), so org creation never needs the admin client.
create or replace function create_organization_with_owner(p_name text)
returns organizations
language plpgsql
security definer
as $$
declare
  new_org organizations;
begin
  insert into organizations (name, owner_id)
  values (p_name, auth.uid())
  returning * into new_org;

  insert into org_members (org_id, user_id, role)
  values (new_org.id, auth.uid(), 'owner');

  return new_org;
end;
$$;
