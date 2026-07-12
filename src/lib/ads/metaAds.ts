const GRAPH_VERSION = "v21.0";
const GRAPH_URL = `https://graph.facebook.com/${GRAPH_VERSION}`;

export async function listMetaAdAccounts(accessToken: string): Promise<Array<{ id: string; name: string }>> {
  const res = await fetch(`${GRAPH_URL}/me/adaccounts?fields=id,name&access_token=${accessToken}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message ?? "Couldn't list Meta ad accounts");
  return data.data ?? [];
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
    access_token: accessToken,
  });
  const res = await fetch(`${GRAPH_URL}/act_${adAccountId}/campaigns`, { method: "POST", body });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error?.message ?? "Couldn't create the Meta campaign");
  return { campaignId: data.id };
}
