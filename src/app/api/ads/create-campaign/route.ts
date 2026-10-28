import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { listMetaAdAccounts, createMetaCampaign, createMetaAdSet, createMetaAd } from "@/lib/ads/metaAds";
import type { Database } from "@/types/database";

interface CreateCampaignBody {
  orgId?: string;
  name?: string;
  goal?: string;
  dailyBudget?: number;
  targeting?: { cityKeys: string[]; cityNames: string[]; ageMin: number; ageMax: number; genders: "all" | "male" | "female" };
  creative?: { headline: string; primaryText: string; cta: string; imageUrl: string; destinationUrl: string };
}

export async function POST(request: NextRequest) {
  let body: CreateCampaignBody;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { orgId, name, goal, dailyBudget, targeting, creative } = body;
  if (!orgId || !name || !goal || !dailyBudget || !targeting || !creative) {
    return Response.json({ error: "orgId, name, goal, dailyBudget, targeting, and creative are all required" }, { status: 400 });
  }
  if (!creative.imageUrl || !creative.destinationUrl) {
    return Response.json({ error: "An image and a destination link are required for the ad" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });

  const { data: membership } = await supabase.from("org_members").select("id").eq("org_id", orgId).eq("user_id", user.id).maybeSingle();
  if (!membership) return Response.json({ error: "Not a member of this organization" }, { status: 403 });

  const { data: allAccounts } = await supabase.from("social_accounts").select("*").eq("org_id", orgId).eq("is_active", true);
  const adsAccount = (allAccounts ?? []).find((a) => a.platform === "meta_ads");
  const fbAccounts = (allAccounts ?? []).filter((a) => a.platform === "facebook");
  const pageAccount = fbAccounts.find((a) => a.is_default) ?? fbAccounts[0];

  if (!adsAccount?.access_token) return Response.json({ error: "Connect Meta (Facebook) in Social Accounts first — ads need an ads_management-scoped connection" }, { status: 400 });
  if (!pageAccount) return Response.json({ error: "Connect a Facebook Page in Social Accounts first — the ad creative needs a Page to run from" }, { status: 400 });

  try {
    const adAccounts = await listMetaAdAccounts(adsAccount.access_token);
    if (adAccounts.length === 0) throw new Error("No accessible Meta ad accounts found for this login — make sure your Facebook account has an ad account set up in Business Manager");
    const adAccountId = adAccounts[0].id.replace("act_", "");

    const { campaignId: metaCampaignId } = await createMetaCampaign({
      accessToken: adsAccount.access_token,
      adAccountId,
      name,
      goal,
    });

    const { adSetId } = await createMetaAdSet({
      accessToken: adsAccount.access_token,
      adAccountId,
      campaignId: metaCampaignId,
      name: `${name} — Ad Set`,
      goal,
      dailyBudgetInr: dailyBudget,
      targeting: { cityKeys: targeting.cityKeys, ageMin: targeting.ageMin, ageMax: targeting.ageMax, genders: targeting.genders },
    });

    const { adId } = await createMetaAd({
      accessToken: adsAccount.access_token,
      adAccountId,
      adSetId,
      pageId: pageAccount.account_id,
      name: `${name} — Ad`,
      headline: creative.headline,
      primaryText: creative.primaryText,
      cta: creative.cta,
      imageUrl: creative.imageUrl,
      destinationUrl: creative.destinationUrl,
    });

    const { data: savedCampaign, error: saveError } = await supabase
      .from("campaigns")
      .insert({
        org_id: orgId,
        name,
        type: "ads",
        goal: goal as Database["public"]["Tables"]["campaigns"]["Row"]["goal"],
        status: "paused",
        platforms: ["Meta Ads"],
        budget: dailyBudget,
        target_audience: {
          cities: targeting.cityNames,
          age_min: targeting.ageMin,
          age_max: targeting.ageMax,
          genders: targeting.genders,
        } as unknown as Database["public"]["Tables"]["campaigns"]["Row"]["target_audience"],
        ai_strategy: `${creative.primaryText}\n\nCTA: ${creative.cta}`,
        start_date: null,
        end_date: null,
        created_by: user.id,
        performance: {
          launched_platform: "facebook",
          campaign_id: metaCampaignId,
          ad_set_id: adSetId,
          ad_id: adId,
          account: adAccounts[0].name,
          note: "Created PAUSED — review targeting/budget/creative in Meta Ads Manager and activate it there",
        } as unknown as Database["public"]["Tables"]["campaigns"]["Row"]["performance"],
      })
      .select("*")
      .single();

    if (saveError) throw new Error(saveError.message);

    return Response.json({
      success: true,
      campaign: savedCampaign,
      externalIds: { campaignId: metaCampaignId, adSetId, adId },
      note: "Campaign, ad set, and ad created PAUSED on Meta — review and activate it in Ads Manager when you're ready to spend.",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Campaign creation failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
