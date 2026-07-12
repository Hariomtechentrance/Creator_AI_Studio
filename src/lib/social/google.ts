const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

export function isGoogleConfigured(): boolean {
  const id = process.env.GOOGLE_CLIENT_ID;
  const secret = process.env.GOOGLE_CLIENT_SECRET;
  return !!id && !id.startsWith("your_") && !!secret && !secret.startsWith("your_");
}

export function getGoogleAuthUrl(redirectUri: string, state: string): string {
  const scopes = [
    "https://www.googleapis.com/auth/youtube.upload",
    "https://www.googleapis.com/auth/youtube.readonly",
    "https://www.googleapis.com/auth/adwords",
  ];
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID as string,
    redirect_uri: redirectUri,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    scope: scopes.join(" "),
    state,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}

export async function exchangeGoogleCode(code: string, redirectUri: string): Promise<GoogleTokenResponse> {
  const params = new URLSearchParams({
    code,
    client_id: process.env.GOOGLE_CLIENT_ID as string,
    client_secret: process.env.GOOGLE_CLIENT_SECRET as string,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });
  const res = await fetch(TOKEN_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: params });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description ?? "Google token exchange failed");
  return data;
}

export async function refreshGoogleToken(refreshToken: string): Promise<string> {
  const params = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: process.env.GOOGLE_CLIENT_ID as string,
    client_secret: process.env.GOOGLE_CLIENT_SECRET as string,
    grant_type: "refresh_token",
  });
  const res = await fetch(TOKEN_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: params });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description ?? "Google token refresh failed");
  return data.access_token;
}

export async function getYoutubeChannel(accessToken: string): Promise<{ id: string; title: string } | null> {
  const res = await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message ?? "Couldn't fetch YouTube channel");
  const channel = data.items?.[0];
  return channel ? { id: channel.id, title: channel.snippet?.title ?? "YouTube Channel" } : null;
}

/**
 * Resumable upload of a video (downloaded from `videoUrl`, e.g. a Replicate
 * output) to the connected YouTube channel. Uses the two-step resumable
 * upload protocol: initiate a session, then PUT the video bytes.
 */
export async function uploadYoutubeVideo(accessToken: string, videoUrl: string, title: string, description: string): Promise<string> {
  const videoRes = await fetch(videoUrl);
  if (!videoRes.ok) throw new Error("Couldn't download the video to upload");
  const videoBuffer = await videoRes.arrayBuffer();

  const initRes = await fetch(
    "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Upload-Content-Type": "video/mp4",
        "X-Upload-Content-Length": String(videoBuffer.byteLength),
      },
      body: JSON.stringify({
        snippet: { title, description, categoryId: "22" },
        status: { privacyStatus: "public" },
      }),
    },
  );
  const uploadUrl = initRes.headers.get("location");
  if (!initRes.ok || !uploadUrl) {
    const err = await initRes.json().catch(() => ({}));
    throw new Error(err.error?.message ?? "Couldn't start YouTube upload session");
  }

  const uploadRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": "video/mp4", "Content-Length": String(videoBuffer.byteLength) },
    body: videoBuffer,
  });
  const uploadData = await uploadRes.json();
  if (!uploadRes.ok) throw new Error(uploadData.error?.message ?? "YouTube upload failed");
  return uploadData.id;
}
