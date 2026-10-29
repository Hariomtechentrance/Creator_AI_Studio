import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { updateMetaAdSetBudget } from "@/lib/ads/metaAds";
import type { Database } from "@/types/database";

export async function POST(request: NextRequest) {
  let body: { campaignId?: string; dailyBudget?: number };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { campaignId, dailyBudget } = body;
  if (!campaignId || !dailyBudget || dailyBudget < 100) {
    return Response.json({ error: "campaignId and a dailyBudget of at least ₹100 are required" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });

  const { data: campaign } = await supabase.from("campaigns").select("*").eq("id", campaignId).single();
  if (!campaign) return Response.json({ error: "Campaign not found" }, { status: 404 });

  const performance = campaign.performance as unknown as { ad_set_id?: string; launched_platform?: string } | null;
  const adSetId = performance?.ad_set_id;
  if (!adSetId || performance?.launched_platform !== "facebook") {
    return Response.json({ error: "This campaign hasn't been launched on Meta yet — nothing to update there" }, { status: 400 });
  }

  const { data: accounts } = await supabase.from("social_accounts").select("*").eq("org_id", campaign.org_id).eq("platform", "meta_ads").eq("is_active", true);
  const account = accounts?.[0];
  if (!account?.access_token) return Response.json({ error: "Meta isn't connected for this organization" }, { status: 400 });

  try {
    await updateMetaAdSetBudget(account.access_token, adSetId, dailyBudget);
    await supabase.from("campaigns").update({ budget: dailyBudget } as Database["public"]["Tables"]["campaigns"]["Update"]).eq("id", campaignId);
    return Response.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Couldn't update the budget on Meta";
    return Response.json({ error: message }, { status: 500 });
  }
}
