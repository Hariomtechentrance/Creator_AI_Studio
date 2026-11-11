// PiAPI's Kling image-to-video API — cheaper than Kling-via-Replicate
// (~$0.10-0.20/sec vs Replicate's ~$0.25/sec for the same model, per live
// pricing research, not guessed). Request/response shapes verified against
// PiAPI's own docs (piapi.ai/docs/kling-api/create-task, /get-task), not
// assumed from Replicate's unrelated schema.
const PIAPI_BASE = "https://api.piapi.ai/api/v1";

export function isPiapiConfigured(): boolean {
  const key = process.env.PIAPI_API_KEY;
  return !!key && key !== "your_piapi_key_for_kling";
}

function apiKey(): string {
  const key = process.env.PIAPI_API_KEY;
  if (!key) throw new Error("PIAPI_API_KEY is not configured");
  return key;
}

interface CreateTaskResponse {
  code: number;
  data?: { task_id?: string };
  message?: string;
}

interface GetTaskResponse {
  code: number;
  data?: {
    status?: string;
    output?: { video?: string };
    error?: { code: number; message: string };
  };
  message?: string;
}

const POLL_INTERVAL_MS = 5000;
const POLL_TIMEOUT_MS = 10 * 60 * 1000;

async function pollTask(taskId: string): Promise<string> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    const res = await fetch(`${PIAPI_BASE}/task/${taskId}`, { headers: { "x-api-key": apiKey() } });
    const body = (await res.json()) as GetTaskResponse;
    // Docs show inconsistent casing ("Completed" in the schema enum,
    // "completed" in examples) — normalize rather than trust one case.
    const status = (body.data?.status ?? "").toLowerCase();
    if (status === "completed") {
      const videoUrl = body.data?.output?.video;
      if (!videoUrl) throw new Error("PiAPI task completed but returned no video URL");
      return videoUrl;
    }
    if (status === "failed") {
      throw new Error(body.data?.error?.message ?? "PiAPI video generation failed");
    }
    // "pending" | "processing" | "staged" — keep polling
  }
  throw new Error("PiAPI video generation timed out after 10 minutes");
}

/**
 * Animates a single source image into a short video via PiAPI's Kling
 * endpoint. imageUrl must be a real fetchable HTTP(S) URL, not a data: URI
 * — upload any data: URL to storage first and pass the resulting URL here.
 */
export async function generateKlingVideoViaPiapi(input: {
  imageUrl: string;
  prompt: string;
  durationSeconds?: number;
  aspectRatio?: "16:9" | "9:16" | "1:1";
}): Promise<string> {
  const { imageUrl, prompt, durationSeconds = 5, aspectRatio = "9:16" } = input;

  // 3.0-turbo supports 3-15s durations (vs 2.6's fixed 5-or-10), matching
  // this app's variable per-scene durations without forcing a round number.
  const clampedDuration = Math.min(15, Math.max(3, Math.round(durationSeconds)));

  const createRes = await fetch(`${PIAPI_BASE}/task`, {
    method: "POST",
    headers: { "x-api-key": apiKey(), "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "kling",
      task_type: "video_generation",
      input: {
        image_url: imageUrl,
        prompt,
        duration: clampedDuration,
        mode: "std",
        aspect_ratio: aspectRatio,
        version: "3.0-turbo",
      },
      config: { service_mode: "public" },
    }),
  });
  const createBody = (await createRes.json()) as CreateTaskResponse;
  if (!createRes.ok || createBody.code !== 200 || !createBody.data?.task_id) {
    throw new Error(createBody.message ?? `PiAPI task creation failed (${createRes.status})`);
  }

  return pollTask(createBody.data.task_id);
}
