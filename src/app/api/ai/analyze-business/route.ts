import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getBrandProfile } from "@/lib/supabase/brand";
import { getLeads } from "@/lib/supabase/leads";
import { analyzeBusiness } from "@/lib/ai/businessAnalysis";
import { isAnthropicConfigured } from "@/lib/ai/anthropic";
import { notifyOrgMembers } from "@/lib/supabase/notifications-server";
import type { Database } from "@/types/database";

function isSupabaseConfigured(): boolean {
  return (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").startsWith("http");
}

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return Response.json({ error: "Sign in to generate AI insights" }, { status: 400 });
  }
  if (!isAnthropicConfigured()) {
    return Response.json({ error: "AI insights aren't configured yet — add GROQ_API_KEY" }, { status: 400 });
  }

  let body: { orgId?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { orgId } = body;
  if (!orgId) {
    return Response.json({ error: "orgId is required" }, { status: 400 });
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
  if (!brandProfile) {
    return Response.json({ error: "Complete brand onboarding before generating AI insights" }, { status: 400 });
  }

  const leads = await getLeads(supabase, orgId);

  try {
    const result = await analyzeBusiness({ org, brandProfile, leads });

    await supabase
      .from("brand_profiles")
      .update({
        ai_brand_summary: result.brandSummary,
        ai_strategy: {
          content_pillars: result.contentPillars,
          recommended_platforms: result.recommendedPlatforms,
        },
        ai_last_analyzed_at: new Date().toISOString(),
      })
      .eq("org_id", orgId);

    await supabase.from("ai_reports").insert({
      org_id: orgId,
      report_type: "on_demand",
      period_start: null,
      period_end: null,
      insights: result.insights as unknown as Database["public"]["Tables"]["ai_reports"]["Row"]["insights"],
      recommendations: result.recommendations as unknown as Database["public"]["Tables"]["ai_reports"]["Row"]["recommendations"],
      red_flags: result.redFlags as unknown as Database["public"]["Tables"]["ai_reports"]["Row"]["red_flags"],
      opportunities: result.opportunities as unknown as Database["public"]["Tables"]["ai_reports"]["Row"]["opportunities"],
      generated_by: "claude-opus-4-8",
    });

    if (result.redFlags.length > 0) {
      await notifyOrgMembers(orgId, {
        type: "ai_warning",
        title: `AI found ${result.redFlags.length} issue${result.redFlags.length === 1 ? "" : "s"} to review`,
        body: result.redFlags[0]?.title,
        data: { redFlags: result.redFlags } as unknown as Database["public"]["Tables"]["notifications"]["Row"]["data"],
      });
    }

    return Response.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI analysis failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
