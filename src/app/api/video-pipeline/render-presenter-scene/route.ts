import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { spendCredits } from "@/lib/credits";
import { isHeyGenConfigured, generateSceneVideoFromImage } from "@/lib/ai/heygen";

export const maxDuration = 300;

const COST = 30; // same per-scene cost as the Avatar Studio HeyGen render

function isSupabaseConfigured(): boolean {
  return (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").startsWith("http");
}

export async function POST(request: NextRequest) {
  if (!isHeyGenConfigured()) {
    return Response.json({ error: "AI Video Pipeline needs HEYGEN_API_KEY configured in .env.local" }, { status: 400 });
  }

  let body: { assetId?: string; script?: string; voiceId?: string; orgId?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { assetId, voiceId, orgId } = body;
  const script = body.script?.trim();
  if (!assetId || !voiceId || !script) {
    return Response.json({ error: "assetId, voiceId, and script are required" }, { status: 400 });
  }

  const authEnabled = isSupabaseConfigured();
  let userId: string | null = null;
  let creditsBefore = 0;

  if (authEnabled) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Sign in to render a scene" }, { status: 401 });
    userId = user.id;

    const admin = createAdminClient();
    const { data: profile } = await admin.from("profiles").select("credits").eq("id", userId).single();
    if (!profile) return Response.json({ error: "Profile not found" }, { status: 404 });
    creditsBefore = profile.credits;
    if (creditsBefore < COST) {
      return Response.json({ error: `Not enough credits — this needs ${COST}, you have ${creditsBefore}` }, { status: 402 });
    }

    if (orgId) {
      const { data: membership } = await supabase
        .from("org_members")
        .select("id")
        .eq("org_id", orgId)
        .eq("user_id", userId)
        .maybeSingle();
      if (!membership) return Response.json({ error: "Not a member of this organization" }, { status: 403 });
    }
  }

  try {
    const videoUrl = await generateSceneVideoFromImage({ assetId, script, voiceId });

    if (authEnabled && userId) {
      const admin = createAdminClient();
      if (!(await spendCredits(admin, userId, COST))) {
        return Response.json({ error: "Not enough credits — top up to continue" }, { status: 402 });
      }
      await admin.from("generations").insert({
        user_id: userId,
        type: "avatar_video",
        prompt: script,
        model: "heygen",
        status: "completed",
        output_urls: [videoUrl],
        settings: { assetId, voiceId, fromCustomFace: true },
        credits_used: COST,
      });
      await admin.from("credit_transactions").insert({
        user_id: userId,
        amount: -COST,
        type: "spent",
        description: "AI Video Pipeline — presenter scene render",
      });
    }

    return Response.json({ videoUrl, creditsUsed: authEnabled ? COST : 0 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Scene video generation failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
