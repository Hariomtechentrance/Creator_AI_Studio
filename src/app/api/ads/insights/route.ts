import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getMetaCampaignInsights } from "@/lib/ads/metaAds";

export async function GET(request: NextRequest) {
  const campaignId = request.nextUrl.searchParams.get("campaignId");
  if (!campaignId) return Response.json({ error: "campaignId is required" }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });

  // RLS (org_access_campaigns) already scopes this to orgs the user belongs to.
  const { data: campaign } = await supabase.from("campaigns").select("*").eq("id", campaignId).single();
  if (!campaign) return Response.json({ error: "Campaign not found" }, { status: 404 });

  const performance = campaign.performance as unknown as { campaign_id?: string; launched_platform?: string } | null;
  const externalCampaignId = performance?.campaign_id;
  if (!externalCampaignId || performance?.launched_platform !== "facebook") {
    return Response.json({ error: "This campaign hasn't been launched on Meta yet — no insights to show" }, { status: 400 });
  }

  const { data: accounts } = await supabase.from("social_accounts").select("*").eq("org_id", campaign.org_id).eq("platform", "meta_ads").eq("is_active", true);
  const account = accounts?.[0];
  if (!account?.access_token) return Response.json({ error: "Meta isn't connected for this organization" }, { status: 400 });

  try {
    const insights = await getMetaCampaignInsights(account.access_token, externalCampaignId);
    return Response.json({ insights });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Couldn't fetch insights";
    return Response.json({ error: message }, { status: 500 });
  }
}
