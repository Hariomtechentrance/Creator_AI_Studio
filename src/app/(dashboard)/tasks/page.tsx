import TasksView from "@/components/tasks/TasksView";
import { createClient } from "@/lib/supabase/server";
import { getUserOrgs, getOrgMembersWithProfiles } from "@/lib/supabase/organizations";
import { resolveActiveOrg } from "@/lib/supabase/activeOrg";
import { getTasksForOrg } from "@/lib/supabase/tasks";
import { getLeads } from "@/lib/supabase/leads";
import type { OrgMemberWithProfile } from "@/lib/supabase/organizations";
import type { Task, Lead } from "@/types/database";

async function getPageData() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (!supabaseUrl.startsWith("http")) {
    return { orgId: null, userId: null, tasks: [] as Task[], leads: [] as Lead[], members: [] as OrgMemberWithProfile[] };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { orgId: null, userId: null, tasks: [] as Task[], leads: [] as Lead[], members: [] as OrgMemberWithProfile[] };
  }

  const orgs = await getUserOrgs(supabase, user.id);
  const org = await resolveActiveOrg(orgs);
  if (!org) {
    return { orgId: null, userId: user.id, tasks: [] as Task[], leads: [] as Lead[], members: [] as OrgMemberWithProfile[] };
  }

  const [tasks, leads, members] = await Promise.all([
    getTasksForOrg(supabase, org.id),
    getLeads(supabase, org.id),
    getOrgMembersWithProfiles(supabase, org.id),
  ]);

  return { orgId: org.id, userId: user.id, tasks, leads, members };
}

export default async function TasksPage() {
  const { orgId, userId, tasks, leads, members } = await getPageData();

  return <TasksView orgId={orgId} userId={userId} initialTasks={tasks} leads={leads} members={members} />;
}
