import Replicate from "replicate";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 300;

function isSupabaseConfigured(): boolean {
  return (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").startsWith("http");
}
function isConfigured(val: string | undefined, placeholder: string): val is string {
  return !!val && val !== placeholder;
}

/**
 * Only Replicate is wired for real — RUNWAY_API_KEY/LUMA_API_KEY/PIAPI_API_KEY
 * exist as placeholders in .env.local but no direct-API integration was
 * built for them (each has its own request/response shape and this wasn't
 * verified against a live account). "kling"/"luma" below map to their
 * Replicate-hosted equivalents; "runway"/"pika" aren't reliably available
 * on Replicate and return a clear error instead of a fabricated call.
 */
const REPLICATE_VIDEO_MODEL_MAP: Record<string, `${string}/${string}`> = {
  kling: "kwaivgi/kling-v1.6-standard",
  luma: "luma/ray",
};

function extractUrl(item: unknown): string | null {
  if (!item) return null;
  if (typeof (item as { url?: () => string }).url === "function") return (item as { url: () => string }).url();
  if (typeof item === "string") return item;
  return null;
}

export async function POST(request: NextRequest) {
  let body: { prompt?: string; provider?: string; duration?: number; image?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { prompt, provider = "kling", duration = 5, image } = body;
  if (!prompt?.trim()) {
    return Response.json({ error: "Prompt is required" }, { status: 400 });
  }

  const modelId = REPLICATE_VIDEO_MODEL_MAP[provider];
  const replicateToken = process.env.REPLICATE_API_TOKEN;
  if (!modelId) {
    return Response.json({ error: `${provider} isn't directly integrated yet — try Kling or Luma, which run via Replicate` }, { status: 400 });
  }
  if (!isConfigured(replicateToken, "your_replicate_api_token")) {
    return Response.json({ error: "Video generation needs REPLICATE_API_TOKEN configured in .env.local" }, { status: 400 });
  }

  const authEnabled = isSupabaseConfigured();
  let userId: string | null = null;
  let creditsBefore = 0;
  const cost = 20;

  if (authEnabled) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Sign in to generate videos" }, { status: 401 });
    userId = user.id;

    const admin = createAdminClient();
    const { data: profile } = await admin.from("profiles").select("credits").eq("id", userId).single();
    if (!profile) return Response.json({ error: "Profile not found" }, { status: 404 });
    creditsBefore = profile.credits;
    if (creditsBefore < cost) {
      return Response.json({ error: `Not enough credits — this needs ${cost}, you have ${creditsBefore}` }, { status: 402 });
    }
  }

  try {
    const replicate = new Replicate({ auth: replicateToken });
    const input: Record<string, unknown> = { prompt, duration };
    if (image) input.start_image = image;

    const output = await replicate.run(modelId, { input });
    const videoUrl = Array.isArray(output) ? extractUrl(output[0]) : extractUrl(output);
    if (!videoUrl) throw new Error("The provider returned no video");

    if (authEnabled && userId) {
      const admin = createAdminClient();
      await admin.from("profiles").update({ credits: creditsBefore - cost }).eq("id", userId);
      await admin.from("generations").insert({
        user_id: userId,
        type: "video",
        prompt,
        model: provider,
        status: "completed",
        output_urls: [videoUrl],
        settings: { duration, hadReferenceImage: !!image },
        credits_used: cost,
      });
      await admin.from("credit_transactions").insert({
        user_id: userId,
        amount: -cost,
        type: "spent",
        description: `${provider} video generation`,
      });
    }

    return Response.json({ videoUrl, creditsUsed: authEnabled ? cost : 0 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Video generation failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
