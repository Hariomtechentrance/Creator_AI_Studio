import Replicate from "replicate";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { derivePbrMaps } from "@/lib/textures/pbr";

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

const cost = 15;
const toDataUrl = (buf: Buffer) => `data:image/png;base64,${buf.toString("base64")}`;

/**
 * The diffuse/albedo map is a real Replicate flux-dev generation. The other
 * 5 maps (height/normal/roughness/AO/metallic) are derived deterministically
 * from that diffuse image via image processing (see lib/textures/pbr.ts) —
 * there's no verified, stable Replicate model for single-image PBR material
 * estimation to call instead. Height/normal/roughness/AO are real
 * derivations from the actual pixel data (heuristic, not measured — same
 * technique lightweight texture tools use); metallic can't be inferred from
 * a single photo at all, so it's a flat non-metallic placeholder, not a
 * fabricated value.
 */
export async function POST(request: NextRequest) {
  let body: { prompt?: string; style?: string; resolution?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { prompt, style = "Realistic", resolution = "1024x1024" } = body;
  if (!prompt?.trim()) {
    return Response.json({ error: "A material description is required" }, { status: 400 });
  }

  const replicateToken = process.env.REPLICATE_API_TOKEN;
  if (!isConfigured(replicateToken, "your_replicate_api_token")) {
    return Response.json({ error: "Texture generation needs REPLICATE_API_TOKEN configured in .env.local" }, { status: 400 });
  }

  const authEnabled = isSupabaseConfigured();
  let userId: string | null = null;
  let creditsBefore = 0;

  if (authEnabled) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Sign in to generate textures" }, { status: 401 });
    userId = user.id;

    const admin = createAdminClient();
    const { data: profile } = await admin.from("profiles").select("credits").eq("id", userId).single();
    if (!profile) return Response.json({ error: "Profile not found" }, { status: 404 });
    creditsBefore = profile.credits;
    if (creditsBefore < cost) {
      return Response.json({ error: `Not enough credits — this needs ${cost}, you have ${creditsBefore}` }, { status: 402 });
    }
  }

  const [w, h] = resolution.split("x").map(Number);
  const fullPrompt = `seamless tileable ${style.toLowerCase()} texture, ${prompt.trim()}, PBR material, top-down flat lighting, no shadows, high detail, 4k`;

  try {
    const replicate = new Replicate({ auth: replicateToken });
    const output = await replicate.run("black-forest-labs/flux-dev", {
      input: { prompt: fullPrompt, width: w || 1024, height: h || 1024, num_outputs: 1 },
    });
    const diffuseUrl = Array.isArray(output) ? extractUrl(output[0]) : extractUrl(output);
    if (!diffuseUrl) throw new Error("The provider returned no texture");

    const diffuseRes = await fetch(diffuseUrl);
    if (!diffuseRes.ok) throw new Error("Couldn't download the generated diffuse map");
    const diffuseBuffer = Buffer.from(await diffuseRes.arrayBuffer());

    const maps = await derivePbrMaps(diffuseBuffer);
    const maps_out = {
      diffuseUrl: toDataUrl(maps.diffuse),
      heightUrl: toDataUrl(maps.height),
      normalUrl: toDataUrl(maps.normal),
      roughnessUrl: toDataUrl(maps.roughness),
      aoUrl: toDataUrl(maps.ao),
      metallicUrl: toDataUrl(maps.metallic),
    };

    if (authEnabled && userId) {
      const admin = createAdminClient();
      await admin.from("profiles").update({ credits: creditsBefore - cost }).eq("id", userId);
      await admin.from("generations").insert({
        user_id: userId,
        type: "texture",
        prompt,
        model: "flux-dev+derived-pbr",
        status: "completed",
        output_urls: [diffuseUrl],
        settings: { style, resolution },
        credits_used: cost,
      });
      await admin.from("credit_transactions").insert({
        user_id: userId,
        amount: -cost,
        type: "spent",
        description: "Texture generation (full PBR set)",
      });
    }

    return Response.json({ ...maps_out, creditsUsed: authEnabled ? cost : 0 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Texture generation failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
