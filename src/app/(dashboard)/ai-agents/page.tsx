import AiAgentsView from "@/components/ai-agents/AiAgentsView";
import { createClient } from "@/lib/supabase/server";
import { getUserOrgs } from "@/lib/supabase/organizations";
import { resolveActiveOrg } from "@/lib/supabase/activeOrg";
import { getLeads } from "@/lib/supabase/leads";
import type { Lead } from "@/types/database";

async function getPageData(): Promise<{ orgId: string | null; leads: Lead[] }> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (!supabaseUrl.startsWith("http")) return { orgId: null, leads: [] };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { orgId: null, leads: [] };

  const orgs = await getUserOrgs(supabase, user.id);
  const org = await resolveActiveOrg(orgs);
  if (!org) return { orgId: null, leads: [] };

  const leads = await getLeads(supabase, org.id);
  return { orgId: org.id, leads };
}

export default async function AiAgentsPage() {
  const { orgId, leads } = await getPageData();
  return <AiAgentsView orgId={orgId} leads={leads} />;
}
