import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { updateMetaCampaignStatus } from "@/lib/ads/metaAds";

export async function POST(request: NextRequest) {
  let body: { campaignId?: string; status?: "active" | "paused" };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { campaignId, status } = body;
  if (!campaignId || !status) return Response.json({ error: "campaignId and status are required" }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });

  // RLS (org_access_campaigns) already scopes this to orgs the user belongs to.
  const { data: campaign } = await supabase.from("campaigns").select("*").eq("id", campaignId).single();
  if (!campaign) return Response.json({ error: "Campaign not found" }, { status: 404 });

  const performance = campaign.performance as unknown as { campaign_id?: string; launched_platform?: string } | null;
  const externalCampaignId = performance?.campaign_id;

  // A draft campaign never reached Meta at all — there's nothing real to
  // toggle, so just flip the local label (what it was doing before this fix,
  // and still correct for this one case since no live ad exists yet).
  if (!externalCampaignId || performance?.launched_platform !== "facebook") {
    const { error } = await supabase.from("campaigns").update({ status }).eq("id", campaignId);
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ success: true, syncedToMeta: false });
  }

  const { data: accounts } = await supabase.from("social_accounts").select("*").eq("org_id", campaign.org_id).eq("platform", "meta_ads").eq("is_active", true);
  const account = accounts?.[0];
  if (!account?.access_token) return Response.json({ error: "Meta isn't connected for this organization" }, { status: 400 });

  try {
    await updateMetaCampaignStatus(account.access_token, externalCampaignId, status === "active" ? "ACTIVE" : "PAUSED");
    // Only reflect the change locally once Meta has actually confirmed it —
    // this is the opposite order of the old behavior, which updated the
    // local label unconditionally regardless of whether Meta agreed.
    const { error } = await supabase.from("campaigns").update({ status }).eq("id", campaignId);
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ success: true, syncedToMeta: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Couldn't update status on Meta";
    return Response.json({ error: message }, { status: 500 });
  }
}
