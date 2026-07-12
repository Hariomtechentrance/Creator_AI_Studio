// Google Ads API — version-pinned to v17 (current stable as of this
// integration). Google deprecates versions roughly every 6 months; if this
// starts 404ing, bump GOOGLE_ADS_API_VERSION below and check
// https://developers.google.com/google-ads/api/docs/release-notes
const GOOGLE_ADS_API_VERSION = "v17";
const BASE_URL = `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}`;

export function isGoogleAdsConfigured(): boolean {
  const token = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  return !!token && !token.startsWith("your_");
}

function headers(accessToken: string) {
  return {
    Authorization: `Bearer ${accessToken}`,
    "developer-token": process.env.GOOGLE_ADS_DEVELOPER_TOKEN as string,
    "login-customer-id": (process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID ?? "").replace(/-/g, ""),
    "Content-Type": "application/json",
  };
}

export async function listAccessibleGoogleAdsCustomers(accessToken: string): Promise<string[]> {
  const res = await fetch(`${BASE_URL}/customers:listAccessibleCustomers`, { headers: headers(accessToken) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message ?? "Couldn't list Google Ads accounts");
  return (data.resourceNames ?? []).map((r: string) => r.replace("customers/", ""));
}

/**
 * Creates a PAUSED search campaign with a daily budget — deliberately not
 * ENABLED, so nothing spends money until the business owner reviews and
 * activates it directly in Google Ads. A real campaign also needs ad
 * groups, ads, and keywords before it can serve at all; this creates the
 * campaign shell only.
 */
export async function createGoogleSearchCampaign(input: {
  accessToken: string;
  customerId: string;
  name: string;
  dailyBudgetInr: number;
}): Promise<{ campaignResourceName: string }> {
  const { accessToken, customerId, name, dailyBudgetInr } = input;
  const micros = Math.round(dailyBudgetInr * 1_000_000);

  const budgetRes = await fetch(`${BASE_URL}/customers/${customerId}/campaignBudgets:mutate`, {
    method: "POST",
    headers: headers(accessToken),
    body: JSON.stringify({
      operations: [{ create: { name: `${name} — Budget`, amountMicros: String(micros), deliveryMethod: "STANDARD" } }],
    }),
  });
  const budgetData = await budgetRes.json();
  if (!budgetRes.ok) throw new Error(budgetData.error?.message ?? "Couldn't create the campaign budget");
  const budgetResourceName = budgetData.results[0].resourceName;

  const campaignRes = await fetch(`${BASE_URL}/customers/${customerId}/campaigns:mutate`, {
    method: "POST",
    headers: headers(accessToken),
    body: JSON.stringify({
      operations: [{
        create: {
          name,
          status: "PAUSED",
          advertisingChannelType: "SEARCH",
          campaignBudget: budgetResourceName,
          manualCpc: {},
        },
      }],
    }),
  });
  const campaignData = await campaignRes.json();
  if (!campaignRes.ok) throw new Error(campaignData.error?.message ?? "Couldn't create the campaign");

  return { campaignResourceName: campaignData.results[0].resourceName };
}
