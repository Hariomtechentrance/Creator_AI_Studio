import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getBrandProfile } from "@/lib/supabase/brand";
import { generateAdCopy } from "@/lib/ai/adCopy";
import { isAnthropicConfigured } from "@/lib/ai/anthropic";

function isSupabaseConfigured(): boolean {
  return (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").startsWith("http");
}

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return Response.json({ error: "Sign in to generate ad copy" }, { status: 400 });
  }
  if (!isAnthropicConfigured()) {
    return Response.json({ error: "Ad copy generation isn't configured yet — add ANTHROPIC_API_KEY" }, { status: 400 });
  }

  let body: { orgId?: string; platform?: string; goal?: string; productDescription?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { orgId, platform, goal, productDescription } = body;
  if (!orgId || !platform || !goal || !productDescription?.trim()) {
    return Response.json({ error: "orgId, platform, goal, and productDescription are required" }, { status: 400 });
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

  const brandProfile = await getBrandProfile(supabase, orgId);

  try {
    const result = await generateAdCopy({ platform, goal, productDescription, brandProfile });
    return Response.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Ad copy generation failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
