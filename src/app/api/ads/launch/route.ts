import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { listAccessibleGoogleAdsCustomers, createGoogleSearchCampaign, isGoogleAdsConfigured } from "@/lib/ads/googleAds";
import { listMetaAdAccounts, createMetaCampaign } from "@/lib/ads/metaAds";
import type { Database } from "@/types/database";

export async function POST(request: NextRequest) {
  let body: { campaignId?: string; platform?: "google_ads" | "facebook"; dailyBudget?: number };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { campaignId, platform, dailyBudget = 500 } = body;
  if (!campaignId || !platform) {
    return Response.json({ error: "campaignId and platform are required" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });

  const { data: campaign } = await supabase.from("campaigns").select("*").eq("id", campaignId).single();
  if (!campaign) return Response.json({ error: "Campaign not found" }, { status: 404 });

  // Ad-account-level calls need the user-level "meta_ads" token (has
  // ads_management) — the "facebook" row only holds a Page token, which
  // can't call /act_{id}/... endpoints. This was silently broken before:
  // it queried the Page token here and every Meta launch would have failed.
  const tokenPlatform = platform === "facebook" ? "meta_ads" : platform;
  const { data: accounts } = await supabase
    .from("social_accounts")
    .select("*")
    .eq("org_id", campaign.org_id)
    .eq("platform", tokenPlatform)
    .eq("is_active", true);
  const account = (accounts ?? []).find((a) => a.is_default) ?? accounts?.[0];

  if (!account || !account.access_token) {
    return Response.json({ error: `${platform === "google_ads" ? "Google Ads" : "Meta"} isn't connected — see Social Accounts` }, { status: 400 });
  }

  try {
    let externalId: string;
    let accountLabel: string;

    if (platform === "google_ads") {
      if (!isGoogleAdsConfigured()) throw new Error("GOOGLE_ADS_DEVELOPER_TOKEN isn't configured in .env.local");
      const customers = await listAccessibleGoogleAdsCustomers(account.access_token);
      if (customers.length === 0) throw new Error("No accessible Google Ads accounts found for this login");
      const customerId = customers[0];
      const { campaignResourceName } = await createGoogleSearchCampaign({
        accessToken: account.access_token,
        customerId,
        name: campaign.name,
        dailyBudgetInr: dailyBudget,
      });
      externalId = campaignResourceName;
      accountLabel = customerId;
    } else {
      const adAccounts = await listMetaAdAccounts(account.access_token);
      if (adAccounts.length === 0) throw new Error("No accessible Meta ad accounts found for this login");
      const adAccountId = adAccounts[0].id.replace("act_", "");
      const { campaignId: metaCampaignId } = await createMetaCampaign({
        accessToken: account.access_token,
        adAccountId,
        name: campaign.name,
        goal: campaign.goal,
      });
      externalId = metaCampaignId;
      accountLabel = adAccounts[0].name;
    }

    await supabase
      .from("campaigns")
      .update({
        status: "paused",
        performance: {
          launched_platform: platform,
          external_id: externalId,
          account: accountLabel,
          note: "Created PAUSED — review targeting/creative and activate directly on the ad platform",
        } as unknown as Database["public"]["Tables"]["campaigns"]["Row"]["performance"],
      })
      .eq("id", campaignId);

    return Response.json({ success: true, externalId, note: "Campaign created PAUSED on the ad platform — activate it there once you've reviewed targeting and added creative." });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Launch failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
