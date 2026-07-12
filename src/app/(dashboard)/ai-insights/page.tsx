import AiInsightsView from "@/components/ai-insights/AiInsightsView";
import { createClient } from "@/lib/supabase/server";
import { getUserOrgs } from "@/lib/supabase/organizations";
import { resolveActiveOrg } from "@/lib/supabase/activeOrg";
import { getBrandProfile } from "@/lib/supabase/brand";
import { getLeads } from "@/lib/supabase/leads";
import { getLatestReport } from "@/lib/supabase/aiReports";

async function getPageData() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (!supabaseUrl.startsWith("http")) {
    return { orgId: null, brandOnboarded: false, leadsCount: 0, brandSummary: null, initialReport: null };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { orgId: null, brandOnboarded: false, leadsCount: 0, brandSummary: null, initialReport: null };
  }

  const orgs = await getUserOrgs(supabase, user.id);
  const org = await resolveActiveOrg(orgs);
  if (!org) {
    return { orgId: null, brandOnboarded: false, leadsCount: 0, brandSummary: null, initialReport: null };
  }

  const [brandProfile, leads, initialReport] = await Promise.all([
    getBrandProfile(supabase, org.id),
    getLeads(supabase, org.id),
    getLatestReport(supabase, org.id),
  ]);

  return {
    orgId: org.id,
    brandOnboarded: !!brandProfile,
    leadsCount: leads.length,
    brandSummary: brandProfile?.ai_brand_summary ?? null,
    initialReport,
  };
}

export default async function AiInsightsPage() {
  const data = await getPageData();

  return <AiInsightsView {...data} />;
}
