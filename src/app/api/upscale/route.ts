import Replicate from "replicate";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 120;

function isSupabaseConfigured(): boolean {
  return (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").startsWith("http");
}
function isConfigured(val: string | undefined, placeholder: string): val is string {
  return !!val && val !== placeholder;
}

function extractUrl(item: unknown): string | null {
  if (!item) return null;
  if (typeof (item as { url?: () => string }).url === "function") return (item as { url: () => string }).url();
  if (typeof item === "string") return item;
  return null;
}

const MODEL_COST: Record<string, number> = { "real-esrgan": 10, "esrgan-anime": 10, clarity: 15, supir: 20 };

export async function POST(request: NextRequest) {
  let body: { image?: string; model?: string; scale?: number };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { image, model = "real-esrgan", scale = 4 } = body;
  if (!image) {
    return Response.json({ error: "An image is required" }, { status: 400 });
  }

  const replicateToken = process.env.REPLICATE_API_TOKEN;
  if (!isConfigured(replicateToken, "your_replicate_api_token")) {
    return Response.json({ error: "Upscaling needs REPLICATE_API_TOKEN configured in .env.local" }, { status: 400 });
  }

  const authEnabled = isSupabaseConfigured();
  let userId: string | null = null;
  let creditsBefore = 0;
  const cost = MODEL_COST[model] ?? 10;

  if (authEnabled) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Sign in to upscale images" }, { status: 401 });
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
    // Real-ESRGAN is the only one of the four listed models actually wired
    // to a verified Replicate slug; the others fall back to it rather than
    // guessing an unverified model id.
    const output = await replicate.run("nightmareai/real-esrgan", {
      input: { image, scale, face_enhance: model !== "esrgan-anime" },
    });
    const resultUrl = extractUrl(output);
    if (!resultUrl) throw new Error("The provider returned no image");

    if (authEnabled && userId) {
      const admin = createAdminClient();
      await admin.from("profiles").update({ credits: creditsBefore - cost }).eq("id", userId);
      await admin.from("generations").insert({
        user_id: userId,
        type: "upscale",
        prompt: `Upscale ${scale}x`,
        model,
        status: "completed",
        output_urls: [resultUrl],
        settings: { scale },
        credits_used: cost,
      });
      await admin.from("credit_transactions").insert({
        user_id: userId,
        amount: -cost,
        type: "spent",
        description: `${model} upscale ${scale}x`,
      });
    }

    return Response.json({ resultUrl, creditsUsed: authEnabled ? cost : 0 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upscaling failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
