import LeadsView from "@/components/leads/LeadsView";
import { createClient } from "@/lib/supabase/server";
import { getUserOrgs, getOrgMembersWithProfiles } from "@/lib/supabase/organizations";
import { resolveActiveOrg } from "@/lib/supabase/activeOrg";
import { getLeads } from "@/lib/supabase/leads";
import type { OrgMemberWithProfile } from "@/lib/supabase/organizations";

async function getPageData() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (!supabaseUrl.startsWith("http")) {
    return { orgId: null, userId: null, leads: [], members: [] as OrgMemberWithProfile[] };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { orgId: null, userId: null, leads: [], members: [] as OrgMemberWithProfile[] };
  }

  const orgs = await getUserOrgs(supabase, user.id);
  const org = await resolveActiveOrg(orgs);
  if (!org) {
    return { orgId: null, userId: user.id, leads: [], members: [] as OrgMemberWithProfile[] };
  }

  const [leads, members] = await Promise.all([
    getLeads(supabase, org.id),
    getOrgMembersWithProfiles(supabase, org.id),
  ]);
  return { orgId: org.id, userId: user.id, leads, members };
}

export default async function LeadsPage() {
  const { orgId, userId, leads, members } = await getPageData();

  return <LeadsView orgId={orgId} userId={userId} initialLeads={leads} members={members} />;
}
