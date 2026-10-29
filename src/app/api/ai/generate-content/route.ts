import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { spendCredits } from "@/lib/credits";
import { getBrandProfile } from "@/lib/supabase/brand";
import { generateContent } from "@/lib/ai/contentGeneration";
import { isAnthropicConfigured } from "@/lib/ai/anthropic";
import type { Database } from "@/types/database";

const COST = 5;

function isSupabaseConfigured(): boolean {
  return (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").startsWith("http");
}

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return Response.json({ error: "Sign in to generate content" }, { status: 400 });
  }
  if (!isAnthropicConfigured()) {
    return Response.json({ error: "Content generation isn't configured yet — add GROQ_API_KEY" }, { status: 400 });
  }

  let body: { orgId?: string; topic?: string; contentType?: string; tone?: string; platforms?: string[] };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { orgId, topic, contentType, tone, platforms } = body;
  if (!orgId || !topic?.trim() || !platforms?.length) {
    return Response.json({ error: "orgId, topic, and at least one platform are required" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Sign in required" }, { status: 401 });
  }

  const { data: membership } = await supabase
    .from("org_members")
    .select("id")
    .eq("org_id", orgId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) {
    return Response.json({ error: "Not a member of this organization" }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("credits").eq("id", user.id).single();
  if (!profile) return Response.json({ error: "Profile not found" }, { status: 404 });
  const creditsBefore = profile.credits;
  if (creditsBefore < COST) {
    return Response.json({ error: `Not enough credits — this needs ${COST}, you have ${creditsBefore}` }, { status: 402 });
  }

  const brandProfile = await getBrandProfile(supabase, orgId);

  try {
    const variations = await generateContent({
      topic,
      contentType: contentType || "post",
      tone: tone || "Professional",
      platforms,
      brandProfile,
    });

    if (!(await spendCredits(admin, user.id, COST))) {
      return Response.json({ error: "Not enough credits — top up to continue" }, { status: 402 });
    }
    await admin.from("generations").insert({
      user_id: user.id,
      type: "content",
      prompt: topic,
      model: "groq",
      status: "completed",
      output_urls: [],
      settings: { contentType, tone, platforms } as unknown as Database["public"]["Tables"]["generations"]["Row"]["settings"],
      credits_used: COST,
    });
    await admin.from("credit_transactions").insert({
      user_id: user.id,
      amount: -COST,
      type: "spent",
      description: "Content Studio generation",
    });

    return Response.json({ variations, creditsUsed: COST });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Content generation failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
