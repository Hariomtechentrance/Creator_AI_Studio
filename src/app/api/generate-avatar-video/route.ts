import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getBrandProfile } from "@/lib/supabase/brand";
import { isHeyGenConfigured, generateAvatarVideo } from "@/lib/ai/heygen";
import { expandIdeaToScript } from "@/lib/ai/avatarScript";
import { isAnthropicConfigured } from "@/lib/ai/anthropic";

export const maxDuration = 300;

const COST = 30; // reflects HeyGen's real ~$1/min pay-as-you-go cost, higher than Replicate video's 20cr

function isSupabaseConfigured(): boolean {
  return (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").startsWith("http");
}

export async function POST(request: NextRequest) {
  if (!isHeyGenConfigured()) {
    return Response.json({ error: "AI Avatar Studio needs HEYGEN_API_KEY configured in .env.local" }, { status: 400 });
  }

  let body: { avatarId?: string; voiceId?: string; script?: string; idea?: string; orgId?: string; previewOnly?: boolean };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { avatarId, voiceId, orgId, previewOnly } = body;
  const script = body.script?.trim();
  const idea = body.idea?.trim();

  // Preview mode: expand an idea into an editable script only — no HeyGen
  // call, no credits spent, no avatar/voice required yet. Lets the user
  // review/edit what will be said before paying for the video.
  if (previewOnly) {
    if (!idea) return Response.json({ error: "Provide an idea to expand into a script" }, { status: 400 });
    if (!isAnthropicConfigured()) {
      return Response.json({ error: "Script preview needs GROQ_API_KEY configured — or write your own script instead" }, { status: 400 });
    }
    try {
      let brandProfile = null;
      if (orgId && isSupabaseConfigured()) {
        const supabase = await createClient();
        brandProfile = await getBrandProfile(supabase, orgId);
      }
      const generatedScript = await expandIdeaToScript({ idea, brandProfile });
      return Response.json({ script: generatedScript });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Couldn't generate a script from that idea";
      return Response.json({ error: message }, { status: 500 });
    }
  }

  if (!avatarId || !voiceId) {
    return Response.json({ error: "avatarId and voiceId are required" }, { status: 400 });
  }
  if (!script && !idea) {
    return Response.json({ error: "Provide a script or an idea to expand into one" }, { status: 400 });
  }

  const authEnabled = isSupabaseConfigured();
  let userId: string | null = null;
  let creditsBefore = 0;
  let supabase: Awaited<ReturnType<typeof createClient>> | null = null;

  if (authEnabled) {
    supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Sign in to generate avatar videos" }, { status: 401 });
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
    let finalScript = script;
    if (!finalScript) {
      if (!isAnthropicConfigured()) {
        return Response.json({ error: "Describing an idea needs GROQ_API_KEY configured — or write your own script instead" }, { status: 400 });
      }
      const brandProfile = orgId && supabase ? await getBrandProfile(supabase, orgId) : null;
      finalScript = await expandIdeaToScript({ idea: idea!, brandProfile });
    }

    const videoUrl = await generateAvatarVideo({ avatarId, voiceId, script: finalScript });

    if (authEnabled && userId) {
      const admin = createAdminClient();
      await admin.from("profiles").update({ credits: creditsBefore - COST }).eq("id", userId);
      await admin.from("generations").insert({
        user_id: userId,
        type: "avatar_video",
        prompt: finalScript,
        model: "heygen",
        status: "completed",
        output_urls: [videoUrl],
        settings: { avatarId, voiceId, fromIdea: !script },
        credits_used: COST,
      });
      await admin.from("credit_transactions").insert({
        user_id: userId,
        amount: -COST,
        type: "spent",
        description: "HeyGen avatar video generation",
      });
    }

    return Response.json({ videoUrl, script: finalScript, creditsUsed: authEnabled ? COST : 0 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Avatar video generation failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
