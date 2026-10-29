import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { spendCredits } from "@/lib/credits";
import { getBrandProfile } from "@/lib/supabase/brand";
import { generateSceneScript } from "@/lib/ai/sceneScript";
import { isAnthropicConfigured } from "@/lib/ai/anthropic";
import type { Database } from "@/types/database";

export const maxDuration = 60;

const COST = 10;

function isSupabaseConfigured(): boolean {
  return (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").startsWith("http");
}

export async function POST(request: NextRequest) {
  if (!isAnthropicConfigured()) {
    return Response.json({ error: "Scene script generation needs GROQ_API_KEY configured in .env.local" }, { status: 400 });
  }

  let body: { topic?: string; orgId?: string; numScenes?: number; categoryId?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const topic = body.topic?.trim();
  const { orgId, numScenes, categoryId } = body;
  if (!topic) return Response.json({ error: "A topic or brief is required" }, { status: 400 });

  const authEnabled = isSupabaseConfigured();
  let userId: string | null = null;
  let creditsBefore = 0;
  let supabase: Awaited<ReturnType<typeof createClient>> | null = null;

  if (authEnabled) {
    supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Sign in to generate a scene script" }, { status: 401 });
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
    const brandProfile = orgId && supabase ? await getBrandProfile(supabase, orgId) : null;
    const scenes = await generateSceneScript({ topic, brandProfile, numScenes, categoryId });

    if (authEnabled && userId) {
      const admin = createAdminClient();
      if (!(await spendCredits(admin, userId, COST))) {
        return Response.json({ error: "Not enough credits — top up to continue" }, { status: 402 });
      }
      await admin.from("generations").insert({
        user_id: userId,
        type: "scene_script",
        prompt: topic,
        model: "claude-opus-4-8",
        status: "completed",
        output_urls: [],
        settings: { scenes, categoryId } as unknown as Database["public"]["Tables"]["generations"]["Row"]["settings"],
        credits_used: COST,
      });
      await admin.from("credit_transactions").insert({
        user_id: userId,
        amount: -COST,
        type: "spent",
        description: "Scene-by-scene video script generation",
      });
    }

    return Response.json({ scenes, creditsUsed: authEnabled ? COST : 0 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Scene script generation failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
