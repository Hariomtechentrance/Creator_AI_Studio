import type { NextRequest } from "next/server";
import type { Database } from "@/types/database";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { executeClaudeStudioPrompt } from "@/lib/ai/claudeStudioCopilot";
import { getBrandProfile } from "@/lib/supabase/brand";
import { spendCredits } from "@/lib/credits";

export async function POST(request: NextRequest) {
  let body: {
    orgId?: string;
    prompt?: string;
    destinationUrl?: string;
    action?: "generate" | "save-posts" | "launch-ad";
    postsToSave?: Array<{
      title: string;
      caption: string;
      platforms: ("instagram" | "facebook" | "linkedin" | "twitter")[];
      hashtags: string[];
      mediaPrompt: string;
    }>;
  };

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { orgId, prompt, destinationUrl, action = "generate", postsToSave } = body;

  if (!orgId) {
    return Response.json({ error: "orgId is required" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Sign in required" }, { status: 401 });
  }

  // Check org membership
  const { data: membership } = await supabase
    .from("org_members")
    .select("id, role")
    .eq("org_id", orgId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) {
    return Response.json({ error: "Not a member of this organization" }, { status: 403 });
  }

  const admin = createAdminClient();

  // Action: Save generated posts to content studio
  if (action === "save-posts" && Array.isArray(postsToSave) && postsToSave.length > 0) {
    try {
      const inserts = postsToSave.map((p) => ({
        org_id: orgId,
        title: p.title.slice(0, 80),
        caption: p.caption,
        hashtags: p.hashtags ?? [],
        keywords: [],
        call_to_action: null,
        media_type: "image" as const,
        media_urls: [],
        thumbnail_url: null,
        platforms: p.platforms as unknown as Database["public"]["Tables"]["content_posts"]["Insert"]["platforms"],
        platform_versions: {} as unknown as Database["public"]["Tables"]["content_posts"]["Insert"]["platform_versions"],
        post_type: "organic" as const,
        campaign_id: null,
        ai_generated: true,
        original_prompt: p.mediaPrompt || p.title,
        ai_model_used: "claude-3-5-sonnet",
        approved_by: null,
        approved_at: null,
        scheduled_at: null,
        published_at: null,
        performance_last_synced: null,
        created_by: user.id,
      }));

      const { data: createdPosts, error: postErr } = await admin
        .from("content_posts")
        .insert(inserts)
        .select("id, title");

      if (postErr) throw postErr;

      return Response.json({
        success: true,
        count: createdPosts?.length ?? 0,
        message: `Saved ${createdPosts?.length ?? 0} posts to your Content Studio & Calendar.`,
      });
    } catch (err) {
      return Response.json(
        { error: err instanceof Error ? err.message : "Couldn't save posts" },
        { status: 500 },
      );
    }
  }

  // Default Action: Generate Plan via Claude Copilot
  if (!prompt || !prompt.trim()) {
    return Response.json({ error: "Prompt is required" }, { status: 400 });
  }

  // Fetch user profile to check credits
  const { data: profile } = await admin
    .from("profiles")
    .select("credits, plan")
    .eq("id", user.id)
    .single();

  const currentCredits = profile?.credits ?? 0;
  const ESTIMATED_COST = 25; // base generation cost

  if (currentCredits < ESTIMATED_COST) {
    return Response.json(
      {
        error: `Insufficient credits. You have ${currentCredits} credits, but Claude Copilot requires at least ${ESTIMATED_COST} credits. Please recharge your wallet.`,
        needsRecharge: true,
      },
      { status: 402 },
    );
  }

  try {
    // 1. Fetch organization and brand profile
    const { data: org } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", orgId)
      .single();

    const brandProfile = await getBrandProfile(supabase, orgId);

    // 2. Call Claude Studio Copilot
    const plan = await executeClaudeStudioPrompt({
      prompt: prompt.trim(),
      brandProfile,
      orgName: org?.name ?? undefined,
      destinationUrl: destinationUrl?.trim() || undefined,
    });

    // 3. Deduct credits safely via atomic RPC
    try {
      await spendCredits(admin, user.id, plan.tokenCostCredits || ESTIMATED_COST);
    } catch (creditErr) {
      console.warn("[Credits] spend_credits RPC failed:", creditErr);
    }

    const { data: updatedProfile } = await admin
      .from("profiles")
      .select("credits")
      .eq("id", user.id)
      .single();

    return Response.json({
      success: true,
      plan,
      creditsUsed: plan.tokenCostCredits || ESTIMATED_COST,
      creditsRemaining: updatedProfile?.credits ?? Math.max(0, currentCredits - (plan.tokenCostCredits || ESTIMATED_COST)),
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Claude Copilot generation failed" },
      { status: 500 },
    );
  }
}
