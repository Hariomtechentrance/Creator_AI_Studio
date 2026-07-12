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

/**
 * Text-only share via the UGC Posts API. Image posts need LinkedIn's
 * separate registerUpload asset flow (upload binary to a returned URL, then
 * reference the asset URN here) — not built; imageUrl is accepted in the
 * signature for API-shape consistency with the other platforms but ignored.
 */
export async function postToLinkedIn(memberSub: string, accessToken: string, text: string, _imageUrl?: string): Promise<string> {
  void _imageUrl;
  const author = `urn:li:person:${memberSub}`;
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
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: { text },
          shareMediaCategory: "NONE",
        },
      },
      visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message ?? "LinkedIn post failed");
  return res.headers.get("x-restli-id") ?? data.id ?? "posted";
}
