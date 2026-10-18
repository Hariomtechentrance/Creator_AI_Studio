// HeyGen API client — server-only. Pay-as-you-go REST API, no SDK published
// for Node, so this is a plain fetch wrapper (same approach as this repo's
// other direct-REST providers, e.g. src/lib/messaging/sms.ts).
//
// Uses the v3 API (POST /v3/videos, GET /v3/videos/{id}, /v3/avatars/looks,
// /v3/voices). The older v2 "AI Studio (Legacy)" endpoints are removed on
// 2026-10-31 — do not reintroduce them.
const HEYGEN_API_BASE = "https://api.heygen.com";

export interface HeyGenAvatar {
  id: string;
  name: string;
  previewUrl: string | null;
}

export interface HeyGenVoice {
  id: string;
  name: string;
  language: string | null;
}

export function isHeyGenConfigured(): boolean {
  const key = process.env.HEYGEN_API_KEY;
  return !!key && key !== "your_heygen_api_key";
}

function apiKey(): string {
  const key = process.env.HEYGEN_API_KEY;
  if (!key) throw new Error("HEYGEN_API_KEY is not configured");
  return key;
}

async function heygenFetch(path: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(`${HEYGEN_API_BASE}${path}`, {
    ...init,
    headers: {
      "X-Api-Key": apiKey(),
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    // v3 errors: { error: { code, message } }; occasionally { error: "string" }.
    const err = (body as { error?: { message?: string } | string } | null)?.error;
    const message =
      (typeof err === "string" ? err : err?.message) ?? `HeyGen API error (${res.status})`;
    throw new Error(message);
  }
  return body;
}

/** Curated to a reasonable count for the avatar picker — HeyGen's full catalog runs into the thousands. */
export async function listAvatars(limit = 24): Promise<HeyGenAvatar[]> {
  const body = (await heygenFetch(`/v3/avatars/looks?limit=${limit}`)) as {
    data?: Array<{ id: string; name: string; preview_image_url?: string; status?: string }>;
  };
  const looks = body.data ?? [];
  return looks
    .filter((a) => a.status === undefined || a.status === "completed")
    .slice(0, limit)
    .map((a) => ({
      id: a.id,
      name: a.name,
      previewUrl: a.preview_image_url ?? null,
    }));
}

export async function listVoices(limit = 40): Promise<HeyGenVoice[]> {
  const body = (await heygenFetch(`/v3/voices?limit=${limit}`)) as {
    data?: Array<{ voice_id: string; name: string; language?: string }>;
  };
  const voices = body.data ?? [];
  return voices.slice(0, limit).map((v) => ({
    id: v.voice_id,
    name: v.name,
    language: v.language ?? null,
  }));
}

const POLL_INTERVAL_MS = 4000;
const POLL_TIMEOUT_MS = 4 * 60 * 1000; // stay under the route's maxDuration=300s budget

async function pollVideoUntilDone(videoId: string): Promise<string> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    const statusBody = (await heygenFetch(`/v3/videos/${videoId}`)) as {
      data?: { status?: string; video_url?: string; failure_message?: string | null };
    };
    const status = statusBody.data?.status;
    if (status === "completed" && statusBody.data?.video_url) {
      return statusBody.data.video_url;
    }
    if (status === "failed" || status === "cancelled") {
      throw new Error(statusBody.data?.failure_message ?? `HeyGen video generation ${status}`);
    }
    // status is "waiting" | "pending" | "running" — keep polling
  }
  throw new Error("HeyGen video generation timed out — it may still complete, check your HeyGen dashboard");
}

export async function generateAvatarVideo(input: {
  avatarId: string;
  voiceId: string;
  script: string;
  aspectRatio?: "16:9" | "9:16" | "1:1" | "4:5" | "5:4";
  resolution?: "720p" | "1080p" | "4k";
}): Promise<string> {
  const { avatarId, voiceId, script, aspectRatio = "9:16", resolution = "720p" } = input;

  const submitBody = (await heygenFetch("/v3/videos", {
    method: "POST",
    body: JSON.stringify({
      type: "avatar",
      avatar_id: avatarId,
      script,
      voice_id: voiceId,
      aspect_ratio: aspectRatio,
      resolution,
    }),
  })) as { data?: { video_id?: string }; error?: { message?: string } };

  const videoId = submitBody.data?.video_id;
  if (!videoId) throw new Error(submitBody.error?.message ?? "HeyGen didn't return a video ID");

  return pollVideoUntilDone(videoId);
}

/**
 * Uploads a generated face photo as a reusable HeyGen asset. The returned
 * assetId can be passed straight to generateSceneVideoFromImage as many
 * times as needed — v3 animates any face photo directly via `type: "image"`,
 * no avatar-training step required.
 */
export async function uploadImageAsset(imageBytes: Buffer, mimeType: string): Promise<{ assetId: string; url: string }> {
  // Multipart upload — must NOT go through heygenFetch, which forces
  // Content-Type: application/json for every request.
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(imageBytes)], { type: mimeType }), "face.png");

  const res = await fetch(`${HEYGEN_API_BASE}/v3/assets`, {
    method: "POST",
    headers: { "X-Api-Key": apiKey() },
    body: form,
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const err = (body as { error?: { message?: string } | string } | null)?.error;
    const message = (typeof err === "string" ? err : err?.message) ?? `HeyGen asset upload failed (${res.status})`;
    throw new Error(message);
  }

  const data = (body as { data?: { asset_id?: string; url?: string } })?.data;
  if (!data?.asset_id) throw new Error("HeyGen didn't return an asset ID");
  return { assetId: data.asset_id, url: data.url ?? "" };
}

/** Animates a previously-uploaded face asset (see uploadImageAsset) reading the given script. */
export async function generateSceneVideoFromImage(input: {
  assetId: string;
  script: string;
  voiceId: string;
  aspectRatio?: "16:9" | "9:16" | "1:1" | "4:5" | "5:4";
  resolution?: "720p" | "1080p" | "4k";
}): Promise<string> {
  const { assetId, script, voiceId, aspectRatio = "9:16", resolution = "720p" } = input;

  const submitBody = (await heygenFetch("/v3/videos", {
    method: "POST",
    body: JSON.stringify({
      type: "image",
      image: assetId,
      script,
      voice_id: voiceId,
      aspect_ratio: aspectRatio,
      resolution,
    }),
  })) as { data?: { video_id?: string }; error?: { message?: string } };

  const videoId = submitBody.data?.video_id;
  if (!videoId) throw new Error(submitBody.error?.message ?? "HeyGen didn't return a video ID");

  return pollVideoUntilDone(videoId);
}
