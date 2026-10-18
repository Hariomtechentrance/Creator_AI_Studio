import Replicate from "replicate";
import { Client } from "@gradio/client";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFile, readFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const execFileAsync = promisify(execFile);

// ffmpeg-static computes its binary path from `__dirname`, which Turbopack
// rewrites to a bogus placeholder when bundling server routes — resolve it
// from process.cwd() instead, which Next.js always sets to the project root.
const ffmpegPath = join(process.cwd(), "node_modules", "ffmpeg-static", process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg");

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

function dataUrlToBlob(dataUrl: string): Blob {
  const match = dataUrl.match(/^data:(.+);base64,(.*)$/);
  if (!match) throw new Error("Invalid reference image data");
  return new Blob([Buffer.from(match[2], "base64")], { type: match[1] });
}

/**
 * Free fallback — runs on Lightricks' public "LTX-2-3" Hugging Face Space
 * (community ZeroGPU, no API key needed). No cost, but shared/queued
 * infrastructure: slower and less reliable than a paid provider, and the
 * Space can be paused or change shape without notice.
 */
async function generateWithLTX(prompt: string, duration: number, image?: string): Promise<string> {
  const hfToken = process.env.HUGGINGFACE_API_TOKEN;
  const client = await Client.connect(
    "Lightricks/LTX-2-3",
    isConfigured(hfToken, "your_huggingface_api_token") ? { token: hfToken as `hf_${string}` } : undefined,
  );
  let result;
  try {
    result = await client.predict("/generate_video", {
      input_image: image ? dataUrlToBlob(image) : null,
      prompt,
      duration: Math.min(10, Math.max(1, duration)),
      enhance_prompt: false,
      seed: 42,
      randomize_seed: true,
      height: 1024,
      width: 1536,
    });
  } catch (err) {
    if (err instanceof Error) throw err;
    const status = err as { message?: string; title?: string };
    throw new Error(status?.title ? `${status.title}: ${status.message}` : "The free LTX space failed to respond");
  }
  const data = result.data as Array<{ url?: string } | number>;
  const videoUrl = (data[0] as { url?: string } | undefined)?.url;
  if (!videoUrl) throw new Error("The free LTX space returned no video — it may be paused or overloaded, try Kling or Luma instead");
  return videoUrl;
}

/**
 * Free, real AI text-to-video — runs on a user-owned Google Colab notebook
 * (free T4 GPU, see colab/wan-video-generator.ipynb) exposing a temporary
 * public Gradio URL. No cost, but the notebook must be running and the URL
 * kept current in COLAB_VIDEO_ENDPOINT — Colab sessions disconnect after
 * ~90min idle / ~12h total, unlike a hosted API.
 */
async function generateWithColab(prompt: string, duration: number, endpoint: string): Promise<string> {
  let client;
  try {
    client = await Client.connect(endpoint);
  } catch {
    throw new Error("Couldn't reach the Colab notebook — make sure it's running and COLAB_VIDEO_ENDPOINT matches its current .gradio.live URL");
  }
  let result;
  try {
    result = await client.predict("/predict", [prompt, Math.min(6, Math.max(1, duration)), 42]);
  } catch (err) {
    if (err instanceof Error) throw err;
    const status = err as { message?: string; title?: string };
    throw new Error(status?.title ? `${status.title}: ${status.message}` : "The Colab notebook failed to respond");
  }
  const data = result.data as Array<{ url?: string } | number>;
  const videoUrl = (data[0] as { url?: string } | undefined)?.url;
  if (!videoUrl) throw new Error("The Colab notebook returned no video");
  return videoUrl;
}

const KEN_BURNS_PRESETS: Record<string, { z: [number, number]; x: [number, number]; y: [number, number] }> = {
  None:          { z: [1.0, 1.15], x: [0.5, 0.5], y: [0.5, 0.5] },
  "Pan Left":    { z: [1.25, 1.25], x: [1.0, 0.0], y: [0.5, 0.5] },
  "Pan Right":   { z: [1.25, 1.25], x: [0.0, 1.0], y: [0.5, 0.5] },
  "Zoom In":     { z: [1.0, 1.35], x: [0.5, 0.5], y: [0.5, 0.5] },
  "Zoom Out":    { z: [1.35, 1.0], x: [0.5, 0.5], y: [0.5, 0.5] },
  "Orbit Left":  { z: [1.15, 1.3], x: [0.85, 0.15], y: [0.5, 0.5] },
  "Orbit Right": { z: [1.15, 1.3], x: [0.15, 0.85], y: [0.5, 0.5] },
  "Tilt Up":     { z: [1.25, 1.25], x: [0.5, 0.5], y: [1.0, 0.0] },
  "Tilt Down":   { z: [1.25, 1.25], x: [0.5, 0.5], y: [0.0, 1.0] },
  "Crane Up":    { z: [1.3, 1.05], x: [0.5, 0.5], y: [0.9, 0.1] },
};

/**
 * Fully local, zero-cost provider: applies a Ken Burns pan/zoom effect to an
 * uploaded photo with ffmpeg. No GPU, no external service, no quota — this
 * hardware (4GB VRAM, no CUDA) can't realistically run AI video diffusion
 * models, so this is simulated camera motion on a still photo rather than
 * AI-generated motion, but it's fast and always available.
 */
async function generateWithKenBurns(image: string, duration: number, camera: string): Promise<string> {
  const preset = KEN_BURNS_PRESETS[camera] ?? KEN_BURNS_PRESETS.None;
  const match = image.match(/^data:(.+);base64,(.*)$/);
  if (!match) throw new Error("Invalid image data");

  const fps = 24;
  const clampedDuration = Math.min(10, Math.max(1, duration));
  const frames = fps * clampedDuration;
  const zExpr = `${preset.z[0]}+(${preset.z[1]}-${preset.z[0]})*on/(${frames}-1)`;
  const xExpr = `(${preset.x[0]}+(${preset.x[1]}-${preset.x[0]})*on/(${frames}-1))*(iw-iw/zoom)`;
  const yExpr = `(${preset.y[0]}+(${preset.y[1]}-${preset.y[0]})*on/(${frames}-1))*(ih-ih/zoom)`;
  const filter =
    `scale=3840:2160:force_original_aspect_ratio=increase,crop=3840:2160,` +
    `zoompan=z='${zExpr}':x='${xExpr}':y='${yExpr}':d=1:s=1024x576:fps=${fps}`;

  const id = randomUUID();
  const srcPath = join(tmpdir(), `kb-src-${id}.jpg`);
  const outPath = join(tmpdir(), `kb-out-${id}.mp4`);

  try {
    await writeFile(srcPath, Buffer.from(match[2], "base64"));
    await execFileAsync(ffmpegPath, [
      "-y", "-loop", "1", "-i", srcPath,
      "-vf", filter,
      "-t", String(clampedDuration),
      "-pix_fmt", "yuv420p",
      "-movflags", "+faststart",
      outPath,
    ]);
    const buffer = await readFile(outPath);
    return `data:video/mp4;base64,${buffer.toString("base64")}`;
  } finally {
    await unlink(srcPath).catch(() => {});
    await unlink(outPath).catch(() => {});
  }
}

const CAMERA_SUFFIX: Record<string, string> = {
  "Pan Left": "camera pans left",
  "Pan Right": "camera pans right",
  "Zoom In": "camera slowly zooms in",
  "Zoom Out": "camera slowly zooms out",
  "Orbit Left": "camera orbits left around the subject",
  "Orbit Right": "camera orbits right around the subject",
  "Tilt Up": "camera tilts up",
  "Tilt Down": "camera tilts down",
  "Crane Up": "camera cranes upward, rising shot",
};

export async function POST(request: NextRequest) {
  let body: { prompt?: string; provider?: string; duration?: number; image?: string; camera?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { prompt, provider = "kling", duration = 5, image, camera = "None" } = body;
  if (!prompt?.trim()) {
    return Response.json({ error: "Prompt is required" }, { status: 400 });
  }

  const cameraSuffix = CAMERA_SUFFIX[camera];
  const fullPrompt = cameraSuffix ? `${prompt.trim()}, ${cameraSuffix}` : prompt.trim();

  const isLTX = provider === "ltx";
  const isKenBurns = provider === "kenburns";
  const isColab = provider === "wan";
  const isReplicate = !isLTX && !isKenBurns && !isColab;
  const modelId = isReplicate ? REPLICATE_VIDEO_MODEL_MAP[provider] : undefined;
  const replicateToken = process.env.REPLICATE_API_TOKEN;
  const colabEndpoint = process.env.COLAB_VIDEO_ENDPOINT;
  if (isKenBurns && !image) {
    return Response.json({ error: "The Ken Burns effect needs an uploaded image to animate" }, { status: 400 });
  }
  if (isColab && !isConfigured(colabEndpoint, "your_colab_gradio_url")) {
    return Response.json({ error: "Start colab/wan-video-generator.ipynb in Google Colab and set COLAB_VIDEO_ENDPOINT to its .gradio.live URL" }, { status: 400 });
  }
  if (isReplicate) {
    if (!modelId) {
      return Response.json({ error: `${provider} isn't directly integrated yet — try Kling, Luma, LTX, Wan, or Ken Burns` }, { status: 400 });
    }
    if (!isConfigured(replicateToken, "your_replicate_api_token")) {
      return Response.json({ error: "Video generation needs REPLICATE_API_TOKEN configured in .env.local" }, { status: 400 });
    }
  }

  const authEnabled = isSupabaseConfigured();
  let userId: string | null = null;
  let creditsBefore = 0;
  const cost = isReplicate ? 20 : 0;

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
    let videoUrl: string;
    if (isKenBurns) {
      videoUrl = await generateWithKenBurns(image!, duration, camera);
    } else if (isLTX) {
      videoUrl = await generateWithLTX(fullPrompt, duration, image);
    } else if (isColab) {
      videoUrl = await generateWithColab(fullPrompt, duration, colabEndpoint!);
    } else {
      const replicate = new Replicate({ auth: replicateToken });
      const input: Record<string, unknown> = { prompt: fullPrompt, duration };
      if (image) input.start_image = image;

      const output = await replicate.run(modelId!, { input });
      const url = Array.isArray(output) ? extractUrl(output[0]) : extractUrl(output);
      if (!url) throw new Error("The provider returned no video");
      videoUrl = url;
    }

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
        settings: { duration, camera, hadReferenceImage: !!image },
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
