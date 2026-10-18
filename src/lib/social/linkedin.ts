const AUTH_URL = "https://www.linkedin.com/oauth/v2/authorization";
const TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken";
const API_URL = "https://api.linkedin.com/v2";

export function isLinkedInConfigured(): boolean {
  const id = process.env.LINKEDIN_CLIENT_ID;
  const secret = process.env.LINKEDIN_CLIENT_SECRET;
  return !!id && !id.startsWith("your_") && !!secret && !secret.startsWith("your_");
}

export function getLinkedInAuthUrl(redirectUri: string, state: string): string {
  // w_member_social posts as the connected individual — posting to a
  // Company Page needs LinkedIn's separately-approved Marketing Developer
  // Platform partner access, not built here.
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.LINKEDIN_CLIENT_ID as string,
    redirect_uri: redirectUri,
    state,
    scope: "openid profile w_member_social",
  });
  return `${AUTH_URL}?${params.toString()}`;
}

export async function exchangeLinkedInCode(code: string, redirectUri: string): Promise<string> {
  const params = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: process.env.LINKEDIN_CLIENT_ID as string,
    client_secret: process.env.LINKEDIN_CLIENT_SECRET as string,
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description ?? "LinkedIn token exchange failed");
  return data.access_token;
}

export async function getLinkedInProfile(accessToken: string): Promise<{ sub: string; name: string }> {
  const res = await fetch(`${API_URL}/userinfo`, { headers: { Authorization: `Bearer ${accessToken}` } });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message ?? "Couldn't fetch LinkedIn profile");
  return { sub: data.sub, name: data.name };
}

interface LinkedInRegisterUploadResponse {
  value?: {
    asset?: string;
    uploadMechanism?: {
      "com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"?: { uploadUrl?: string };
    };
  };
}

async function registerLinkedInVideoUpload(memberSub: string, accessToken: string): Promise<{ uploadUrl: string; asset: string }> {
  const res = await fetch(`${API_URL}/assets?action=registerUpload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify({
      registerUploadRequest: {
        recipes: ["urn:li:digitalmediaRecipe:feedshare-video"],
        owner: `urn:li:person:${memberSub}`,
        serviceRelationships: [{ relationshipType: "OWNER", identifier: "urn:li:userGeneratedContent" }],
      },
    }),
  });
  const data = (await res.json()) as LinkedInRegisterUploadResponse & { message?: string };
  if (!res.ok) throw new Error(data.message ?? "LinkedIn video upload registration failed");

  const uploadUrl = data.value?.uploadMechanism?.["com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"]?.uploadUrl;
  const asset = data.value?.asset;
  if (!uploadUrl || !asset) throw new Error("LinkedIn didn't return an upload URL");
  return { uploadUrl, asset };
}

async function uploadLinkedInVideoBytes(uploadUrl: string, accessToken: string, videoUrl: string): Promise<void> {
  const videoRes = await fetch(videoUrl);
  if (!videoRes.ok) throw new Error("Couldn't fetch the stitched video to upload to LinkedIn");
  const bytes = Buffer.from(await videoRes.arrayBuffer());
  const putRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: bytes,
  });
  if (!putRes.ok) throw new Error(`LinkedIn video upload failed (${putRes.status})`);
}

/**
 * Posts via the UGC Posts API (legacy but still-current `/v2/ugcPosts`
 * surface this app already uses — not migrated to LinkedIn's newer
 * versioned REST API here). Video goes through LinkedIn's three-step asset
 * flow: register an upload slot, PUT the raw bytes to the returned URL,
 * then reference the resulting asset URN in the post body. Image posting
 * isn't implemented — mediaType "image" is accepted for signature
 * consistency with the other platforms but falls back to a text-only post.
 */
export async function postToLinkedIn(
  memberSub: string,
  accessToken: string,
  text: string,
  mediaUrl?: string,
  mediaType?: "image" | "video",
): Promise<string> {
  const author = `urn:li:person:${memberSub}`;
  let specificContent: Record<string, unknown> = {
    shareCommentary: { text },
    shareMediaCategory: "NONE",
  };

  if (mediaUrl && mediaType === "video") {
    const { uploadUrl, asset } = await registerLinkedInVideoUpload(memberSub, accessToken);
    await uploadLinkedInVideoBytes(uploadUrl, accessToken, mediaUrl);
    specificContent = {
      shareCommentary: { text },
      shareMediaCategory: "VIDEO",
      media: [{ status: "READY", media: asset }],
    };
  }

  const res = await fetch(`${API_URL}/ugcPosts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify({
      author,
      lifecycleState: "PUBLISHED",
      specificContent: { "com.linkedin.ugc.ShareContent": specificContent },
      visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message ?? "LinkedIn post failed");
  return res.headers.get("x-restli-id") ?? data.id ?? "posted";
}
