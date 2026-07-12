import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getBrandProfile } from "@/lib/supabase/brand";
import { generateLandingPage } from "@/lib/ai/landingPage";
import { isAnthropicConfigured } from "@/lib/ai/anthropic";

function isSupabaseConfigured(): boolean {
  return (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").startsWith("http");
}

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return Response.json({ error: "Sign in to generate a landing page" }, { status: 400 });
  }
  if (!isAnthropicConfigured()) {
    return Response.json({ error: "Landing page generation isn't configured yet — add ANTHROPIC_API_KEY" }, { status: 400 });
  }

  let body: { orgId?: string; topic?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { orgId, topic } = body;
  if (!orgId || !topic?.trim()) {
    return Response.json({ error: "orgId and topic are required" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Sign in required" }, { status: 401 });
  }

  const { data: org } = await supabase.from("organizations").select("*").eq("id", orgId).single();
  if (!org) {
    return Response.json({ error: "Not a member of this organization" }, { status: 403 });
  }

  const brandProfile = await getBrandProfile(supabase, orgId);

  try {
    const page = await generateLandingPage({ topic, brandProfile, orgName: org.name });
    return Response.json(page);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Landing page generation failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
