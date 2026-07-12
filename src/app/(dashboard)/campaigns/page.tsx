import CampaignsView from "@/components/campaigns/CampaignsView";
import { createClient } from "@/lib/supabase/server";
import { getUserOrgs } from "@/lib/supabase/organizations";
import { resolveActiveOrg } from "@/lib/supabase/activeOrg";
import { getCampaigns } from "@/lib/supabase/campaigns";
import type { Campaign } from "@/types/database";

async function getPageData(): Promise<{ orgId: string | null; userId: string | null; campaigns: Campaign[] }> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (!supabaseUrl.startsWith("http")) return { orgId: null, userId: null, campaigns: [] };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { orgId: null, userId: null, campaigns: [] };

  const orgs = await getUserOrgs(supabase, user.id);
  const org = await resolveActiveOrg(orgs);
  if (!org) return { orgId: null, userId: user.id, campaigns: [] };

  const campaigns = await getCampaigns(supabase, org.id);
  return { orgId: org.id, userId: user.id, campaigns };
}

export default async function CampaignsPage() {
  const { orgId, userId, campaigns } = await getPageData();
  return <CampaignsView orgId={orgId} userId={userId} initialCampaigns={campaigns} />;
}
