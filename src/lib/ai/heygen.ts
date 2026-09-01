// HeyGen API client — server-only. Pay-as-you-go REST API, no SDK published
// for Node, so this is a plain fetch wrapper (same approach as this repo's
// other direct-REST providers, e.g. src/lib/messaging/sms.ts).
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
    const message = (body as { error?: { message?: string } } | null)?.error?.message ?? `HeyGen API error (${res.status})`;
    throw new Error(message);
  }
  return body;
}

/** Curated to a reasonable count for the avatar picker — HeyGen's full public catalog runs into the hundreds. */
export async function listAvatars(limit = 24): Promise<HeyGenAvatar[]> {
  const body = (await heygenFetch("/v2/avatars")) as {
    data?: { avatars?: Array<{ avatar_id: string; avatar_name: string; preview_image_url?: string }> };
  };
  const avatars = body.data?.avatars ?? [];
  return avatars.slice(0, limit).map((a) => ({
    id: a.avatar_id,
    name: a.avatar_name,
    previewUrl: a.preview_image_url ?? null,
  }));
}

export async function listVoices(limit = 40): Promise<HeyGenVoice[]> {
  const body = (await heygenFetch("/v2/voices")) as {
    data?: { voices?: Array<{ voice_id: string; name: string; language?: string }> };
  };
  const voices = body.data?.voices ?? [];
  return voices.slice(0, limit).map((v) => ({
    id: v.voice_id,
    name: v.name,
    language: v.language ?? null,
  }));
}

const POLL_INTERVAL_MS = 4000;
const POLL_TIMEOUT_MS = 4 * 60 * 1000; // stay under the route's maxDuration=300s budget

export async function generateAvatarVideo(input: {
  avatarId: string;
  voiceId: string;
  script: string;
  dimension?: { width: number; height: number };
}): Promise<string> {
  const { avatarId, voiceId, script, dimension = { width: 720, height: 1280 } } = input;

  const submitBody = (await heygenFetch("/v2/video/generate", {
    method: "POST",
    body: JSON.stringify({
      video_inputs: [
        {
          character: { type: "avatar", avatar_id: avatarId, avatar_style: "normal" },
          voice: { type: "text", input_text: script, voice_id: voiceId },
        },
      ],
      dimension,
    }),
  })) as { data?: { video_id?: string }; error?: { message?: string } };

  const videoId = submitBody.data?.video_id;
  if (!videoId) throw new Error(submitBody.error?.message ?? "HeyGen didn't return a video ID");

  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    const statusBody = (await heygenFetch(`/v2/video_status.get?video_id=${videoId}`)) as {
      data?: { status?: string; video_url?: string; error?: { message?: string } };
    };
    const status = statusBody.data?.status;
    if (status === "completed" && statusBody.data?.video_url) {
      return statusBody.data.video_url;
    }
    if (status === "failed") {
      throw new Error(statusBody.data?.error?.message ?? "HeyGen video generation failed");
    }
    // status is "pending" or "processing" — keep polling
  }
  throw new Error("HeyGen video generation timed out — it may still complete, check your HeyGen dashboard");
}
