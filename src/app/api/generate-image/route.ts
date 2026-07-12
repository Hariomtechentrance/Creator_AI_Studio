import Replicate from "replicate";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { IMAGE_MODEL_COST, DEFAULT_IMAGE_MODEL_COST } from "@/lib/models";

export const maxDuration = 120;

function isSupabaseConfigured(): boolean {
  return (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").startsWith("http");
}

// ── Human subject detection ────────────────────────────────────────────────

const HUMAN_KEYWORDS = [
  "person", "people", "man", "woman", "boy", "girl", "child", "children",
  "kid", "kids", "baby", "teen", "teenager", "adult", "human", "face",
  "portrait", "couple", "family", "friend", "friends", "student", "soldier",
  "warrior", "queen", "king", "prince", "princess", "model", "actor",
  "actress", "chef", "doctor", "nurse", "teacher", "athlete", "dancer",
  "singer", "photographer", "artist", "old man", "old woman", "elderly",
  "selfie", "headshot", "closeup of a", "close up of a",
];

function isHumanSubject(prompt: string): boolean {
  const lower = prompt.toLowerCase();
  return HUMAN_KEYWORDS.some((kw) => lower.includes(kw));
}

const ART_STYLES = ["Anime", "Sketch", "Minimalist", "Oil Painting", "Watercolor", "Digital Art"];

// ── Prompt construction ────────────────────────────────────────────────────

function buildHumanPrompt(userPrompt: string): string {
  const cleaned = userPrompt.trim().replace(/\s+/g, " ");
  const lower = cleaned.toLowerCase();
  const alreadyFramed =
    lower.startsWith("a photo") || lower.startsWith("photo") ||
    lower.startsWith("portrait") || lower.startsWith("a portrait") ||
    lower.startsWith("candid") || lower.startsWith("shot of");
  return alreadyFramed ? cleaned : "A candid photorealistic photograph of " + cleaned;
}

const HUMAN_PHOTO_BOOST =
  ", shot on Canon EOS R5, 85mm f/1.4 lens, natural ambient lighting, " +
  "photojournalistic style, Kodak Portra 400 color grade, film grain, " +
  "real skin texture, visible skin pores, subsurface scattering, " +
  "sharp eyes in focus, catch lights in eyes, anatomically correct hands, " +
  "8K resolution, high detail";

const HUMAN_NEGATIVE =
  "cartoon, painting, illustration, anime, CGI, 3d render, doll, mannequin, " +
  "plastic skin, airbrushed skin, over-smoothed skin, porcelain skin, wax figure, " +
  "deformed face, asymmetrical face, asymmetrical eyes, crossed eyes, lazy eye, " +
  "bad anatomy, bad proportions, extra limbs, extra fingers, missing fingers, " +
  "fused fingers, too many fingers, mutated hands, poorly drawn hands, " +
  "cloned face, duplicate, blurry, out of focus, motion blur, " +
  "low quality, worst quality, jpeg artifacts, noise, grain artifact, " +
  "watermark, signature, text, logo, username, " +
  "overexposed, underexposed, blown highlights, color banding, chromatic aberration";

const STYLE_SUFFIXES: Record<string, string> = {
  Portrait:       ", professional studio portrait photography, 85mm f/1.4, softbox lighting, catchlights, sharp eyes, skin detail, shallow DOF, elegant composition",
  Photorealistic: ", ultra photorealistic, RAW photo, DSLR, sharp focus, 8K resolution, natural lighting",
  Cinematic:      ", cinematic photography, dramatic lighting, anamorphic lens flare, film grain, color graded, shallow depth of field, movie still",
  Anime:          ", anime style, manga, vibrant colors, Studio Ghibli, cel shading, detailed illustration",
  "Digital Art":  ", digital art, concept art, highly detailed, trending on ArtStation, professional illustration",
  "Oil Painting": ", oil painting, impressionist brushstrokes, rich textures, canvas texture, museum quality",
  Watercolor:     ", watercolor painting, soft edges, flowing colors, wet-on-wet, paper texture",
  Sketch:         ", pencil sketch, detailed crosshatching, grayscale, hand-drawn, graphite",
  "3D Render":    ", 3D render, octane render, ray tracing, physically based materials, 4K, ultra detail",
  Cyberpunk:      ", cyberpunk, neon lights, futuristic city, dark atmosphere, Blade Runner aesthetic",
  Fantasy:        ", fantasy art, magical atmosphere, epic scale, ethereal lighting, detailed illustration",
  Minimalist:     ", minimalist design, clean lines, simple shapes, flat design, negative space",
};

// ── Provider helpers ───────────────────────────────────────────────────────

function isConfigured(val: string | undefined, placeholder: string): val is string {
  return !!val && val !== placeholder;
}

// ── 1. Replicate ───────────────────────────────────────────────────────────

const REPLICATE_MODEL_MAP: Record<string, string> = {
  "flux-dev":       "black-forest-labs/flux-dev",
  "flux-pro":       "black-forest-labs/flux-1.1-pro",
  "flux-schnell":   "black-forest-labs/flux-schnell",
  "sdxl":           "stability-ai/sdxl",
  "ideogram":       "ideogram-ai/ideogram-v2",
  "stable-cascade": "stability-ai/stable-cascade",
};

function extractUrl(item: unknown): string | null {
  if (!item) return null;
  if (typeof (item as { url?: () => string }).url === "function") return (item as { url: () => string }).url();
  if (typeof item === "string") return item;
  return null;
}

async function generateWithReplicate(
  token: string, model: string, prompt: string, negPrompt: string,
  width: number, height: number, count: number, steps: number, guidance: number,
  image?: string, strength?: number,
): Promise<string[]> {
  const replicate = new Replicate({ auth: token });
  const modelId = (REPLICATE_MODEL_MAP[model] ?? REPLICATE_MODEL_MAP["flux-dev"]) as `${string}/${string}`;

  let input: Record<string, unknown>;
  if (model === "sdxl" || model === "stable-cascade") {
    input = { prompt, negative_prompt: negPrompt || undefined, width, height, num_outputs: count, num_inference_steps: steps, guidance_scale: guidance };
    if (image) { input.image = image; input.prompt_strength = strength; }
  } else if (model === "ideogram") {
    input = { prompt, aspect_ratio: `${width}:${height}`, style_type: "REALISTIC" };
    if (image) input.image = image;
  } else {
    input = { prompt, width, height, num_outputs: count, num_inference_steps: steps, guidance };
    if (image) { input.image = image; input.prompt_strength = strength; }
  }

  const output = await replicate.run(modelId, { input });
  const urls: string[] = [];
  if (Array.isArray(output)) {
    for (const item of output) { const u = extractUrl(item); if (u) urls.push(u); }
  } else {
    const u = extractUrl(output); if (u) urls.push(u);
  }
  return urls;
}

// ── 2. OpenAI DALL-E 3 ────────────────────────────────────────────────────
// Best photorealism for humans. Supports HD quality mode.
// DALL-E 3 only allows n=1 per request, so we call it `count` times.

function toDalleSize(w: number, h: number): "1024x1024" | "1792x1024" | "1024x1792" {
  if (w === h) return "1024x1024";
  return w > h ? "1792x1024" : "1024x1792";
}

async function generateWithOpenAI(
  apiKey: string, prompt: string,
  width: number, height: number, count: number,
): Promise<string[]> {
  const size = toDalleSize(width, height);
  const urls: string[] = [];

  for (let i = 0; i < count; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, 1_500));

    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt,
        n: 1,
        size,
        quality: "hd",   // HD mode — sharper, more detail
        style: "natural", // "natural" for photography, "vivid" for art
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as { error?: { message?: string } }).error?.message ?? `OpenAI error ${res.status}`);
    }

    const data = await res.json() as { data: Array<{ url?: string }> };
    const url = data.data[0]?.url;
    if (url) urls.push(url);
  }

  return urls;
}

// ── 3. Stability AI — Stable Image Ultra ──────────────────────────────────
// Excellent realism. Returns raw image bytes → convert to base64 data URL.

function toStabilityRatio(w: number, h: number): string {
  // Stability AI accepts: 1:1, 16:9, 9:16, 4:3, 3:4, 3:2, 2:3, 21:9, 9:21
  const ratio = w / h;
  if (Math.abs(ratio - 1) < 0.05)       return "1:1";
  if (Math.abs(ratio - 16 / 9) < 0.05)  return "16:9";
  if (Math.abs(ratio - 9 / 16) < 0.05)  return "9:16";
  if (Math.abs(ratio - 4 / 3) < 0.05)   return "4:3";
  if (Math.abs(ratio - 3 / 4) < 0.05)   return "3:4";
  if (Math.abs(ratio - 3 / 2) < 0.05)   return "3:2";
  if (Math.abs(ratio - 2 / 3) < 0.05)   return "2:3";
  return "1:1";
}

async function generateWithStability(
  apiKey: string, prompt: string, negPrompt: string,
  width: number, height: number, count: number,
): Promise<string[]> {
  const aspectRatio = toStabilityRatio(width, height);
  const urls: string[] = [];

  for (let i = 0; i < count; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, 1_500));

    const form = new FormData();
    form.append("prompt", prompt);
    if (negPrompt) form.append("negative_prompt", negPrompt);
    form.append("aspect_ratio", aspectRatio);
    form.append("output_format", "webp");

    const res = await fetch("https://api.stability.ai/v2beta/stable-image/generate/ultra", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Accept": "image/*",
      },
      body: form,
    });

    if (!res.ok) {
      const msg = await res.text().catch(() => res.status.toString());
      throw new Error(`Stability AI error ${res.status}: ${msg}`);
    }

    const buffer = await res.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    urls.push(`data:image/webp;base64,${base64}`);
  }

  return urls;
}

async function editWithStability(
  apiKey: string, prompt: string, negPrompt: string,
  image: string, strength: number, count: number,
): Promise<string[]> {
  const base64Data = image.split(",")[1] ?? image;
  const imageBuffer = Buffer.from(base64Data, "base64");
  const urls: string[] = [];

  for (let i = 0; i < count; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, 1_500));

    const form = new FormData();
    form.append("prompt", prompt);
    if (negPrompt) form.append("negative_prompt", negPrompt);
    form.append("mode", "image-to-image");
    form.append("strength", String(strength));
    form.append("output_format", "webp");
    form.append("image", new Blob([imageBuffer]), "reference.png");

    const res = await fetch("https://api.stability.ai/v2beta/stable-image/generate/sd3", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Accept": "image/*",
      },
      body: form,
    });

    if (!res.ok) {
      const msg = await res.text().catch(() => res.status.toString());
      throw new Error(`Stability AI error ${res.status}: ${msg}`);
    }

    const buffer = await res.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    urls.push(`data:image/webp;base64,${base64}`);
  }

  return urls;
}

// ── 4. Pollinations.ai (free fallback) ────────────────────────────────────

const POLLINATIONS_MODEL_MAP: Record<string, string> = {
  "flux-dev":       "flux",
  "flux-pro":       "flux-pro",
  "flux-schnell":   "turbo",
  "sdxl":           "turbo",
  "ideogram":       "flux",
  "stable-cascade": "flux",
};

async function pollinationsFetch(url: string): Promise<void> {
  const delays = [0, 6_000, 12_000];
  let lastStatus = 0;
  for (const delay of delays) {
    if (delay > 0) await new Promise((r) => setTimeout(r, delay));
    const res = await fetch(url, { signal: AbortSignal.timeout(55_000) });
    lastStatus = res.status;
    if (res.ok) return;
    if (res.status !== 429) break;
  }
  throw new Error(`Image generation failed (status ${lastStatus}). Please try again.`);
}

async function generateWithPollinations(
  model: string, prompt: string, negPrompt: string,
  width: number, height: number, count: number, isHuman: boolean,
): Promise<string[]> {
  const pollinationsModel = isHuman ? "flux-pro" : (POLLINATIONS_MODEL_MAP[model] ?? "flux");
  const encodedPrompt = encodeURIComponent(prompt);
  const encodedNeg    = negPrompt ? encodeURIComponent(negPrompt) : "";
  const urls: string[] = [];

  for (let i = 0; i < count; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, 4_000));
    const seed = Date.now() + i * 7919;
    let url =
      `https://image.pollinations.ai/prompt/${encodedPrompt}` +
      `?width=${width}&height=${height}&model=${pollinationsModel}` +
      `&seed=${seed}&nologo=true&nofeed=true`;
    if (encodedNeg) url += `&negative=${encodedNeg}`;
    await pollinationsFetch(url);
    urls.push(url);
  }

  return urls;
}

// ── Route handler ──────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  let body: {
    prompt: string;
    negPrompt?: string;
    model?: string;
    width?: number;
    height?: number;
    count?: number;
    steps?: number;
    guidance?: number;
    style?: string;
    image?: string;
    strength?: number;
  };

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const {
    prompt,
    negPrompt: userNegPrompt = "",
    model = "flux-dev",
    width = 1024,
    height = 1024,
    count = 1,
    steps = 30,
    guidance = 7,
    style = "None",
    image,
    strength = 0.75,
  } = body;

  if (!prompt?.trim()) {
    return Response.json({ error: "Prompt is required" }, { status: 400 });
  }

  // ── Auth + credits (skipped entirely while Supabase isn't configured) ──
  const authEnabled = isSupabaseConfigured();
  let userId: string | null = null;
  let creditsBefore = 0;

  if (authEnabled) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return Response.json({ error: "Sign in to generate images" }, { status: 401 });
    }
    userId = user.id;

    const admin = createAdminClient();
    const { data: profile } = await admin.from("profiles").select("credits").eq("id", userId).single();
    if (!profile) {
      return Response.json({ error: "Profile not found" }, { status: 404 });
    }
    creditsBefore = profile.credits;

    const modelCost = IMAGE_MODEL_COST[model] ?? DEFAULT_IMAGE_MODEL_COST;
    const requestedCost = modelCost * count;
    if (creditsBefore < requestedCost) {
      return Response.json({ error: `Not enough credits — this needs ${requestedCost}, you have ${creditsBefore}` }, { status: 402 });
    }
  }

  const human     = isHumanSubject(prompt);
  const isArtStyle = ART_STYLES.includes(style);

  // Build enhanced prompt
  const basePrompt  = human && !isArtStyle ? buildHumanPrompt(prompt.trim()) : prompt.trim();
  const styleSuffix = style !== "None" ? (STYLE_SUFFIXES[style] ?? "") : "";
  const humanBoost  = human && !isArtStyle ? HUMAN_PHOTO_BOOST : "";
  const fullPrompt  = basePrompt + styleSuffix + humanBoost;

  // Build negative prompt
  const smartNeg     = human && !isArtStyle ? HUMAN_NEGATIVE : "";
  const fullNegative = [userNegPrompt.trim(), smartNeg].filter(Boolean).join(", ");

  // ── Provider selection — first configured wins ─────────────────────────
  const replicateToken  = process.env.REPLICATE_API_TOKEN;
  const openaiKey       = process.env.OPENAI_API_KEY;
  const stabilityKey    = process.env.STABILITY_API_KEY;

  try {
    let images: string[];
    let provider: string;

    if (image) {
      // Editing a reference image — only providers with img2img support can do this.
      if (isConfigured(replicateToken, "your_replicate_api_token")) {
        images   = await generateWithReplicate(replicateToken, model, fullPrompt, fullNegative, width, height, count, steps, guidance, image, strength);
        provider = "Replicate";
      } else if (isConfigured(stabilityKey, "your_stability_api_key")) {
        images   = await editWithStability(stabilityKey, fullPrompt, fullNegative, image, strength, count);
        provider = "Stability AI";
      } else {
        return Response.json({
          error: "Editing a reference image needs Replicate or Stability AI configured. Add REPLICATE_API_TOKEN or STABILITY_API_KEY to .env.local — the free fallback provider only supports text-to-image.",
        }, { status: 400 });
      }
    } else if (isConfigured(replicateToken, "your_replicate_api_token")) {
      images   = await generateWithReplicate(replicateToken, model, fullPrompt, fullNegative, width, height, count, steps, guidance);
      provider = "Replicate";
    } else if (isConfigured(openaiKey, "your_openai_api_key")) {
      images   = await generateWithOpenAI(openaiKey, fullPrompt, width, height, count);
      provider = "OpenAI DALL-E 3";
    } else if (isConfigured(stabilityKey, "your_stability_api_key")) {
      images   = await generateWithStability(stabilityKey, fullPrompt, fullNegative, width, height, count);
      provider = "Stability AI";
    } else {
      images   = await generateWithPollinations(model, fullPrompt, fullNegative, width, height, count, human);
      provider = "Pollinations (free)";
    }

    let creditsUsed = 0;
    if (authEnabled && userId) {
      const modelCost = IMAGE_MODEL_COST[model] ?? DEFAULT_IMAGE_MODEL_COST;
      creditsUsed = modelCost * images.length;

      const admin = createAdminClient();
      await admin.from("profiles").update({ credits: creditsBefore - creditsUsed }).eq("id", userId);
      await admin.from("generations").insert({
        user_id: userId,
        type: "image",
        prompt,
        model,
        status: "completed",
        output_urls: images,
        settings: { negPrompt: userNegPrompt, width, height, style, steps, guidance, hadReferenceImage: !!image },
        credits_used: creditsUsed,
      });
      await admin.from("credit_transactions").insert({
        user_id: userId,
        amount: -creditsUsed,
        type: "spent",
        description: `${model} × ${images.length} image${images.length > 1 ? "s" : ""}`,
      });
    }

    return Response.json({ images, provider, creditsUsed });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Generation failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
