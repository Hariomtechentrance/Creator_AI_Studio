import AutomationsView from "@/components/automations/AutomationsView";
import { createClient } from "@/lib/supabase/server";
import { getUserOrgs } from "@/lib/supabase/organizations";
import { resolveActiveOrg } from "@/lib/supabase/activeOrg";
import { getAutomations, getRecentAutomationLogs } from "@/lib/supabase/automations";
import type { Automation, AutomationLog } from "@/types/database";

async function getPageData() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (!supabaseUrl.startsWith("http")) {
    return { orgId: null, userId: null, automations: [] as Automation[], logs: [] as AutomationLog[] };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { orgId: null, userId: null, automations: [] as Automation[], logs: [] as AutomationLog[] };
  }

  const orgs = await getUserOrgs(supabase, user.id);
  const org = await resolveActiveOrg(orgs);
  if (!org) {
    return { orgId: null, userId: user.id, automations: [] as Automation[], logs: [] as AutomationLog[] };
  }

  const [automations, logs] = await Promise.all([
    getAutomations(supabase, org.id),
    getRecentAutomationLogs(supabase, org.id),
  ]);

  return { orgId: org.id, userId: user.id, automations, logs };
}

export default async function AutomationsPage() {
  const { orgId, userId, automations, logs } = await getPageData();
  return <AutomationsView orgId={orgId} userId={userId} initialAutomations={automations} logs={logs} />;
}
