const GRAPH_VERSION = "v21.0";
const GRAPH_URL = `https://graph.facebook.com/${GRAPH_VERSION}`;

export async function listMetaAdAccounts(accessToken: string): Promise<Array<{ id: string; name: string }>> {
  const res = await fetch(`${GRAPH_URL}/me/adaccounts?fields=id,name&access_token=${accessToken}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message ?? "Couldn't list Meta ad accounts");
  return data.data ?? [];
}

export interface MetaCityResult {
  key: string;
  name: string;
  region: string | null;
  countryCode: string | null;
}

/** Resolves a typed city name to Meta's internal targeting key — required before it can be used in geo_locations. */
export async function searchMetaCities(accessToken: string, query: string): Promise<MetaCityResult[]> {
  const params = new URLSearchParams({
    type: "adgeolocation",
    q: query,
    location_types: JSON.stringify(["city"]),
    access_token: accessToken,
  });
  const res = await fetch(`${GRAPH_URL}/search?${params.toString()}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message ?? "Couldn't search locations");
  return (data.data ?? []).map((c: { key: string; name: string; region?: string; country_code?: string }) => ({
    key: c.key,
    name: c.name,
    region: c.region ?? null,
    countryCode: c.country_code ?? null,
  }));
}

const OBJECTIVE_MAP: Record<string, string> = {
  awareness: "OUTCOME_AWARENESS",
  leads: "OUTCOME_LEADS",
  sales: "OUTCOME_SALES",
  engagement: "OUTCOME_ENGAGEMENT",
  traffic: "OUTCOME_TRAFFIC",
};

/**
 * Creates a PAUSED campaign — deliberately not ACTIVE, so nothing spends
 * until the business owner reviews and activates it in Ads Manager. A real
 * campaign also needs an ad set (budget/targeting) and creative before it
 * can serve; this creates the campaign shell only.
 */
export async function createMetaCampaign(input: {
  accessToken: string;
  adAccountId: string;
  name: string;
  goal: string;
}): Promise<{ campaignId: string }> {
  const { accessToken, adAccountId, name, goal } = input;
  const body = new URLSearchParams({
    name,
    objective: OBJECTIVE_MAP[goal] ?? "OUTCOME_AWARENESS",
    status: "PAUSED",
    special_ad_categories: "[]",
    // Required as of a recent Graph API version (verified live, not in any
    // docs this code was originally written against) — budget lives on the
    // ad set here, not the campaign, so sharing between ad sets is moot;
    // false is the correct value whenever campaign-level budget isn't used.
    is_adset_budget_sharing_enabled: "false",
    access_token: accessToken,
  });
  const res = await fetch(`${GRAPH_URL}/act_${adAccountId}/campaigns`, { method: "POST", body });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error?.message ?? "Couldn't create the Meta campaign");
  return { campaignId: data.id };
}

/**
 * Objective-appropriate optimization goal — Meta requires one that matches
 * the campaign's objective. LEADS/SALES ideally optimize toward
 * on-site conversions, but that needs a Meta Pixel installed on the
 * business's website, which isn't part of this build — falling back to
 * LINK_CLICKS for those keeps the campaign valid and launchable without
 * silently pretending conversion tracking exists.
 */
const OPTIMIZATION_GOAL: Record<string, string> = {
  awareness: "REACH",
  traffic: "LINK_CLICKS",
  engagement: "POST_ENGAGEMENT",
  leads: "LINK_CLICKS",
  sales: "LINK_CLICKS",
};

export interface AdSetTargeting {
  cityKeys: string[];
  ageMin: number;
  ageMax: number;
  genders: "all" | "male" | "female";
}

/** Ad set — the layer that actually carries budget, schedule, and targeting (who/where/how much). Always created PAUSED. */
export async function createMetaAdSet(input: {
  accessToken: string;
  adAccountId: string;
  campaignId: string;
  name: string;
  goal: string;
  dailyBudgetInr: number;
  targeting: AdSetTargeting;
}): Promise<{ adSetId: string }> {
  const { accessToken, adAccountId, campaignId, name, goal, dailyBudgetInr, targeting } = input;

  const geo: Record<string, unknown> = {
    location_types: ["home", "recent"],
  };
  if (targeting.cityKeys.length) {
    geo.cities = targeting.cityKeys.map((key) => ({ key, radius: 10, distance_unit: "mile" }));
  } else {
    geo.countries = ["IN"];
  }

  const targetingSpec: Record<string, unknown> = {
    geo_locations: geo,
    age_min: targeting.ageMin,
    age_max: targeting.ageMax,
  };
  if (targeting.genders === "male") targetingSpec.genders = [1];
  if (targeting.genders === "female") targetingSpec.genders = [2];

  const body = new URLSearchParams({
    name,
    campaign_id: campaignId,
    daily_budget: String(Math.round(dailyBudgetInr * 100)), // Meta budgets are in the account currency's minor unit (paise for INR)
    billing_event: "IMPRESSIONS",
    optimization_goal: OPTIMIZATION_GOAL[goal] ?? "LINK_CLICKS",
    bid_strategy: "LOWEST_COST_WITHOUT_CAP",
    targeting: JSON.stringify(targetingSpec),
    status: "PAUSED",
    access_token: accessToken,
  });
  const res = await fetch(`${GRAPH_URL}/act_${adAccountId}/adsets`, { method: "POST", body });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error?.message ?? "Couldn't create the ad set");
  return { adSetId: data.id };
}

const CTA_MAP: Record<string, string> = {
  "shop now": "SHOP_NOW",
  "learn more": "LEARN_MORE",
  "sign up": "SIGN_UP",
  "get quote": "GET_QUOTE",
  "contact us": "CONTACT_US",
  "send message": "MESSAGE_PAGE",
  "message us": "MESSAGE_PAGE",
  "book now": "BOOK_TRAVEL",
  "download": "DOWNLOAD",
  "call now": "CALL_NOW",
  "apply now": "APPLY_NOW",
};

function resolveCta(cta: string): string {
  return CTA_MAP[cta.trim().toLowerCase()] ?? "LEARN_MORE";
}

/** The actual ad — creative (headline/body/image/destination) attached to the ad set. Always created PAUSED. */
export async function createMetaAd(input: {
  accessToken: string;
  adAccountId: string;
  adSetId: string;
  pageId: string;
  name: string;
  headline: string;
  primaryText: string;
  cta: string;
  imageUrl: string;
  destinationUrl: string;
}): Promise<{ adId: string }> {
  const { accessToken, adAccountId, adSetId, pageId, name, headline, primaryText, cta, imageUrl, destinationUrl } = input;

  const creative = {
    object_story_spec: {
      page_id: pageId,
      link_data: {
        message: primaryText,
        link: destinationUrl,
        picture: imageUrl,
        name: headline,
        call_to_action: { type: resolveCta(cta), value: { link: destinationUrl } },
      },
    },
  };

  const body = new URLSearchParams({
    name,
    adset_id: adSetId,
    status: "PAUSED",
    creative: JSON.stringify(creative),
    access_token: accessToken,
  });
  const res = await fetch(`${GRAPH_URL}/act_${adAccountId}/ads`, { method: "POST", body });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error?.message ?? "Couldn't create the ad");
  return { adId: data.id };
}

export interface MetaCampaignInsights {
  impressions: number;
  clicks: number;
  spend: number;
  ctr: number;
  reach: number;
  hasData: boolean;
}

/**
 * Real performance data for a campaign via the ads_read permission. A
 * campaign that's never been activated (every campaign this app creates
 * starts PAUSED) legitimately has no insights rows yet — that's not an
 * error, it just means nothing has run. hasData distinguishes "zero
 * activity" from "the call itself failed", so the UI can show an honest
 * "not activated yet" state instead of a misleading all-zero chart.
 */
export async function getMetaCampaignInsights(accessToken: string, campaignId: string): Promise<MetaCampaignInsights> {
  const params = new URLSearchParams({
    fields: "impressions,clicks,spend,ctr,reach",
    access_token: accessToken,
  });
  const res = await fetch(`${GRAPH_URL}/${campaignId}/insights?${params.toString()}`);
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error?.message ?? "Couldn't fetch campaign insights");

  const row = data.data?.[0];
  if (!row) return { impressions: 0, clicks: 0, spend: 0, ctr: 0, reach: 0, hasData: false };
  return {
    impressions: Number(row.impressions ?? 0),
    clicks: Number(row.clicks ?? 0),
    spend: Number(row.spend ?? 0),
    ctr: Number(row.ctr ?? 0),
    reach: Number(row.reach ?? 0),
    hasData: true,
  };
}

/**
 * Actually starts/stops the real campaign on Meta — this is the piece that
 * was missing: the app's "Pause"/"Activate" button previously only changed
 * our own database label, which could silently diverge from what the
 * campaign was actually doing (and spending) on Meta's side.
 */
export async function updateMetaCampaignStatus(accessToken: string, campaignId: string, status: "ACTIVE" | "PAUSED"): Promise<void> {
  const body = new URLSearchParams({ status, access_token: accessToken });
  const res = await fetch(`${GRAPH_URL}/${campaignId}`, { method: "POST", body });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error?.message ?? "Couldn't update campaign status on Meta");
}

/** Updates the daily budget on the ad set actually carrying it (campaigns created by this app don't use campaign-level budget — see createMetaAdSet). */
export async function updateMetaAdSetBudget(accessToken: string, adSetId: string, dailyBudgetInr: number): Promise<void> {
  const body = new URLSearchParams({ daily_budget: String(Math.round(dailyBudgetInr * 100)), access_token: accessToken });
  const res = await fetch(`${GRAPH_URL}/${adSetId}`, { method: "POST", body });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error?.message ?? "Couldn't update the budget on Meta");
}
