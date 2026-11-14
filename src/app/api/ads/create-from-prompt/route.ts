import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { interpretCampaignPrompt } from "@/lib/ai/campaignPrompt";
import { renderAdCardPng } from "@/lib/ads/adCardRenderer";
import { listMetaAdAccounts, searchMetaCities, createMetaCampaign, createMetaAdSet, createMetaAd } from "@/lib/ads/metaAds";
import { getBrandProfile } from "@/lib/supabase/brand";
import type { Database } from "@/types/database";

export async function POST(request: NextRequest) {
  let body: { orgId?: string; prompt?: string; destinationUrl?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { orgId, prompt, destinationUrl } = body;
  if (!orgId || !prompt?.trim() || !destinationUrl?.trim()) {
    return Response.json({ error: "orgId, prompt, and destinationUrl are all required" }, { status: 400 });
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

  const { data: org } = await supabase.from("organizations").select("name, meta_pixel_id").eq("id", orgId).single();
  const brandProfile = await getBrandProfile(supabase, orgId);

  try {
    // 1. AI turns the prompt into a complete, structured plan.
    const plan = await interpretCampaignPrompt({ prompt: prompt.trim(), brandProfile });

    // 2. Resolve any named cities to Meta's targeting keys.
    const cityKeys: string[] = [];
    for (const name of plan.cityNames.slice(0, 10)) {
      try {
        const matches = await searchMetaCities(adsAccount.access_token, name);
        if (matches[0]) cityKeys.push(matches[0].key);
      } catch {
        // A city that doesn't resolve just doesn't narrow targeting — not fatal.
      }
    }

    // 3. Render the ad creative deterministically (no AI image model) and host it.
    const png = await renderAdCardPng({
      headline: plan.headline,
      highlights: plan.highlights,
      footerLine: org?.name ?? undefined,
    });
    const admin = createAdminClient();
    const imagePath = `ad-creatives/prompt-${Date.now()}.png`;
    const { error: uploadError } = await admin.storage.from("brand-logos").upload(imagePath, png, { contentType: "image/png", upsert: true });
    if (uploadError) throw new Error(`Couldn't upload the ad creative: ${uploadError.message}`);
    const { data: publicUrl } = admin.storage.from("brand-logos").getPublicUrl(imagePath);
    const imageUrl = publicUrl.publicUrl;

    // 4. Build the real Campaign + Ad Set + Ad on Meta — always PAUSED.
    const adAccounts = await listMetaAdAccounts(adsAccount.access_token);
    if (adAccounts.length === 0) throw new Error("No accessible Meta ad accounts found for this login");
    const adAccountId = adAccounts[0].id.replace("act_", "");

    const name = `${plan.headline.slice(0, 50)} — ${plan.objective}`;
    const { campaignId } = await createMetaCampaign({ accessToken: adsAccount.access_token, adAccountId, name, goal: plan.objective });

    const { adSetId } = await createMetaAdSet({
      accessToken: adsAccount.access_token,
      adAccountId,
      campaignId,
      name: `${name} — Ad Set`,
      goal: plan.objective,
      dailyBudgetInr: plan.dailyBudgetInr,
      targeting: { cityKeys, ageMin: plan.ageMin, ageMax: plan.ageMax, genders: plan.genders },
      pixelId: org?.meta_pixel_id,
    });

    const hashtagLine = plan.hashtags.map((h) => `#${h}`).join(" ");
    const primaryText = `${plan.primaryText}\n\n${hashtagLine}`;

    const { adId } = await createMetaAd({
      accessToken: adsAccount.access_token,
      adAccountId,
      adSetId,
      pageId: pageAccount.account_id,
      name: `${name} — Ad`,
      headline: plan.headline,
      primaryText,
      cta: plan.ctaLabel,
      imageUrl,
      destinationUrl: destinationUrl.trim(),
    });

    // 5. Save it in-app for review, same shape as every other campaign.
    const { data: savedCampaign, error: saveError } = await supabase
      .from("campaigns")
      .insert({
        org_id: orgId,
        name,
        type: "ads",
        goal: plan.objective as Database["public"]["Tables"]["campaigns"]["Row"]["goal"],
        status: "paused",
        platforms: ["Meta Ads"],
        budget: plan.dailyBudgetInr,
        target_audience: {
          cities: plan.cityNames,
          age_min: plan.ageMin,
          age_max: plan.ageMax,
          genders: plan.genders,
        } as unknown as Database["public"]["Tables"]["campaigns"]["Row"]["target_audience"],
        ai_strategy: `${plan.headline}\n\n${primaryText}\n\nCTA: ${plan.ctaLabel}\nDestination: ${destinationUrl.trim()}`,
        start_date: null,
        end_date: null,
        created_by: user.id,
        performance: {
          launched_platform: "facebook",
          campaign_id: campaignId,
          ad_set_id: adSetId,
          ad_id: adId,
          account: adAccounts[0].name,
          note: "Built from a prompt and created PAUSED on Meta — review targeting/creative and activate it yourself when ready.",
        } as unknown as Database["public"]["Tables"]["campaigns"]["Row"]["performance"],
      })
      .select("*")
      .single();

    if (saveError) throw new Error(saveError.message);

    return Response.json({
      success: true,
      campaign: savedCampaign,
      plan,
      imageUrl,
      externalIds: { campaignId, adSetId, adId },
      note: "Built and created PAUSED on Meta from your prompt — review it in Ads Manager before activating.",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Couldn't build the campaign";
    return Response.json({ error: message }, { status: 500 });
  }
}
