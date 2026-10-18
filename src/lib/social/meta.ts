const GRAPH_VERSION = "v21.0";
const GRAPH_URL = `https://graph.facebook.com/${GRAPH_VERSION}`;

export function isMetaConfigured(): boolean {
  const id = process.env.META_APP_ID;
  const secret = process.env.META_APP_SECRET;
  return !!id && !id.startsWith("your_") && !!secret && !secret.startsWith("your_");
}

export function getMetaAuthUrl(redirectUri: string, state: string): string {
  const scopes = ["pages_show_list", "pages_read_engagement", "pages_manage_posts", "instagram_basic", "instagram_content_publish", "business_management", "ads_management"];
  const params = new URLSearchParams({
    client_id: process.env.META_APP_ID as string,
    redirect_uri: redirectUri,
    state,
    scope: scopes.join(","),
    response_type: "code",
  });
  return `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth?${params.toString()}`;
}

interface MetaTokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
}

async function metaFetch<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data.error?.message ?? `Meta API error ${res.status}`);
  }
  return data as T;
}

export async function exchangeMetaCode(code: string, redirectUri: string): Promise<string> {
  const params = new URLSearchParams({
    client_id: process.env.META_APP_ID as string,
    client_secret: process.env.META_APP_SECRET as string,
    redirect_uri: redirectUri,
    code,
  });
  const shortLived = await metaFetch<MetaTokenResponse>(`${GRAPH_URL}/oauth/access_token?${params.toString()}`);

  // Exchange for a long-lived token (~60 days) — short-lived tokens expire in ~1-2h.
  const longParams = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: process.env.META_APP_ID as string,
    client_secret: process.env.META_APP_SECRET as string,
    fb_exchange_token: shortLived.access_token,
  });
  const longLived = await metaFetch<MetaTokenResponse>(`${GRAPH_URL}/oauth/access_token?${longParams.toString()}`);
  return longLived.access_token;
}

export interface MetaPageAccount {
  pageId: string;
  pageName: string;
  pageAccessToken: string;
  instagramAccountId: string | null;
  instagramUsername: string | null;
}

export async function getMetaPages(userAccessToken: string): Promise<MetaPageAccount[]> {
  const data = await metaFetch<{ data: Array<{ id: string; name: string; access_token: string }> }>(
    `${GRAPH_URL}/me/accounts?fields=id,name,access_token&access_token=${userAccessToken}`,
  );

  const pages: MetaPageAccount[] = [];
  for (const page of data.data) {
    let instagramAccountId: string | null = null;
    let instagramUsername: string | null = null;
    try {
      const igData = await metaFetch<{ instagram_business_account?: { id: string } }>(
        `${GRAPH_URL}/${page.id}?fields=instagram_business_account&access_token=${page.access_token}`,
      );
      if (igData.instagram_business_account) {
        instagramAccountId = igData.instagram_business_account.id;
        const igProfile = await metaFetch<{ username?: string }>(
          `${GRAPH_URL}/${instagramAccountId}?fields=username&access_token=${page.access_token}`,
        );
        instagramUsername = igProfile.username ?? null;
      }
    } catch {
      // No Instagram account linked to this page — fine, Facebook-only.
    }
    pages.push({ pageId: page.id, pageName: page.name, pageAccessToken: page.access_token, instagramAccountId, instagramUsername });
  }
  return pages;
}

export async function postToFacebookPage(pageId: string, pageAccessToken: string, message: string, imageUrl?: string, videoUrl?: string): Promise<string> {
  const endpoint = videoUrl ? `${GRAPH_URL}/${pageId}/videos` : imageUrl ? `${GRAPH_URL}/${pageId}/photos` : `${GRAPH_URL}/${pageId}/feed`;
  const body = new URLSearchParams({
    access_token: pageAccessToken,
    ...(videoUrl ? { file_url: videoUrl, description: message } : imageUrl ? { url: imageUrl, caption: message } : { message }),
  });
  const res = await fetch(endpoint, { method: "POST", body });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error?.message ?? "Facebook post failed");
  return data.post_id ?? data.id;
}

const IG_CONTAINER_POLL_INTERVAL_MS = 5000;
const IG_CONTAINER_POLL_TIMEOUT_MS = 4 * 60 * 1000;

/** Video (Reels) containers process asynchronously — image containers are ready immediately, this is only needed for video. */
async function waitForInstagramContainer(containerId: string, pageAccessToken: string): Promise<void> {
  const deadline = Date.now() + IG_CONTAINER_POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const status = await metaFetch<{ status_code?: string }>(
      `${GRAPH_URL}/${containerId}?fields=status_code&access_token=${pageAccessToken}`,
    );
    if (status.status_code === "FINISHED") return;
    if (status.status_code === "ERROR" || status.status_code === "EXPIRED") {
      throw new Error(`Instagram couldn't process the video (${status.status_code})`);
    }
    await new Promise((resolve) => setTimeout(resolve, IG_CONTAINER_POLL_INTERVAL_MS));
  }
  throw new Error("Instagram video processing timed out");
}

export async function postToInstagram(
  igUserId: string,
  pageAccessToken: string,
  mediaUrl: string,
  caption: string,
  mediaType: "image" | "video" = "image",
): Promise<string> {
  // Instagram publishing is a two-step process: create a media container,
  // then publish it — a single "post" call doesn't exist for IG.
  const containerParams: Record<string, string> =
    mediaType === "video"
      ? { media_type: "REELS", video_url: mediaUrl, caption, access_token: pageAccessToken }
      : { image_url: mediaUrl, caption, access_token: pageAccessToken };
  const createRes = await fetch(`${GRAPH_URL}/${igUserId}/media`, { method: "POST", body: new URLSearchParams(containerParams) });
  const createData = await createRes.json();
  if (!createRes.ok || createData.error) throw new Error(createData.error?.message ?? "Instagram media creation failed");

  if (mediaType === "video") {
    await waitForInstagramContainer(createData.id, pageAccessToken);
  }

  const publishBody = new URLSearchParams({ creation_id: createData.id, access_token: pageAccessToken });
  const publishRes = await fetch(`${GRAPH_URL}/${igUserId}/media_publish`, { method: "POST", body: publishBody });
  const publishData = await publishRes.json();
  if (!publishRes.ok || publishData.error) throw new Error(publishData.error?.message ?? "Instagram publish failed");

  return publishData.id;
}
