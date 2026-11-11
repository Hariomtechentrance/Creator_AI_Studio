// Google Business Profile (Google My Business) integration.
//
// Connection flow is intentionally IDENTICAL to the other social networks
// (see ./google.ts / meta.ts / linkedin.ts): one click -> Google consent ->
// back to /social-accounts. It reuses the same GOOGLE_CLIENT_ID / SECRET, so a
// user connects their Business Profile themselves — no manual token pasting.
//
// IMPORTANT OPERATIONAL NOTE (also in PRODUCTION_PRELAUNCH_CHECKLIST.txt):
//   - The Google Cloud project behind GOOGLE_CLIENT_ID must have the
//     "Business Profile APIs" (Google My Business API / Business Profile
//     Management) ENABLED, and the OAuth consent screen must include the
//     `business.manage` scope.
//   - `business.manage` is a RESTRICTED Google scope: production use for OTHER
//     people's businesses requires Google verification (an annual security
//     assessment). Until then the connected accounts work as "test users" only.
//   - Endpoints below use the widely-supported `mybusiness.googleapis.com/v4`
//     surface. Google is migrating to the "Business Profile Platform"; the base
//     URL is centralized so it's a one-line swap when you move over.

const V4 = "https://mybusiness.googleapis.com/v4";
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GBP_SCOPE = "https://www.googleapis.com/auth/business.manage";

export function isGoogleBusinessConfigured(): boolean {
  // Same OAuth client as YouTube/Ads — just a different scope.
  const id = process.env.GOOGLE_CLIENT_ID;
  const secret = process.env.GOOGLE_CLIENT_SECRET;
  return !!id && !id.startsWith("your_") && !!secret && !secret.startsWith("your_");
}

export function getGbpAuthUrl(redirectUri: string, state: string): string {
  const scopes = ["openid", "email", GBP_SCOPE];
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID as string,
    redirect_uri: redirectUri,
    response_type: "code",
    access_type: "offline", // ask for a refresh_token (business.manage tokens expire)
    prompt: "consent",       // force refresh_token even if previously granted
    scope: scopes.join(" "),
    state,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

export interface GbpLocation {
  /** Full resource name: accounts/{accountId}/locations/{locationId} */
  resource: string;
  title: string;
  isVerified: boolean;
}

async function gbpFetch(accessToken: string, path: string, init?: RequestInit) {
  const res = await fetch(`${V4}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (data as { error?: { message?: string } })?.error?.message ?? `Google Business Profile API error (${res.status})`;
    throw new Error(msg);
  }
  return data;
}

/** Lists every business location the authorized Google account can manage. */
export async function listGbpLocations(accessToken: string): Promise<GbpLocation[]> {
  const accounts = await gbpFetch(accessToken, "/accounts?pageSize=1000");
  const out: GbpLocation[] = [];
  for (const acct of (accounts?.accounts ?? []) as { name: string }[]) {
    const { locations } = await gbpFetch(accessToken, `/${acct.name}/locations?pageSize=100`);
    for (const loc of (locations ?? []) as { name: string; title?: string; isVerified?: boolean }[]) {
      out.push({ resource: loc.name, title: loc.title ?? "Business Profile", isVerified: !!loc.isVerified });
    }
  }
  return out;
}

/** Full location object (categories, hours, phone, website, ratings, etc.). */
export async function fetchGbpLocation(accessToken: string, locationResource: string): Promise<Record<string, unknown>> {
  return gbpFetch(accessToken, `/${locationResource}`);
}

/** List of location attributes (accessibility, amenities, payment types...). */
export async function fetchGbpAttributes(accessToken: string, locationResource: string): Promise<string[]> {
  try {
    const data = await gbpFetch(accessToken, `/${locationResource}/attributes`);
    return ((data?.attributes ?? []) as { attributeName: string }[]).map((a) => a.attributeName);
  } catch {
    return [];
  }
}

/** Photo + video counts (Media API). Best-effort — returns 0 if it can't read. */
export async function fetchGbpMediaCounts(accessToken: string, locationResource: string): Promise<{ photos: number; videos: number }> {
  try {
    const data = await gbpFetch(accessToken, `/${locationResource}/media?pageSize=100`);
    const items = (data?.mediaMetadata ?? data?.items ?? []) as {
      mediaFormat?: { category?: string };
      kansasMediaFile?: { mediaType?: string };
    }[];
    let photos = 0;
    let videos = 0;
    for (const m of items) {
      const kind = (m.kansasMediaFile?.mediaType ?? "").toLowerCase();
      if (kind.includes("video") || (m.mediaFormat?.category ?? "").includes("VIDEO")) videos += 1;
      else photos += 1;
    }
    return { photos, videos };
  } catch {
    return { photos: 0, videos: 0 };
  }
}

export interface GbpReview {
  reviewId: string;
  starRating: number;
  comment: string;
  reviewerName: string;
  publishTime: string;
  reply: string | null;
}

/** Reviews + whether each already has a public owner reply. */
export async function fetchGbpReviews(accessToken: string, locationResource: string): Promise<GbpReview[]> {
  const data = await gbpFetch(accessToken, `/${locationResource}/reviews`);
  const reviews = (data?.reviews ?? []) as {
    reviewId?: string;
    review?: {
      starRating?: number;
      comment?: string;
      reviewer?: { displayName?: string };
      publishTime?: string;
      reviewReply?: { comment?: string };
    };
  }[];
  return reviews
    .filter((r) => r.review)
    .map((r) => ({
      reviewId: r.reviewId ?? "",
      starRating: r.review?.starRating ?? 0,
      comment: r.review?.comment ?? "",
      reviewerName: r.review?.reviewer?.displayName ?? "Google user",
      publishTime: r.review?.publishTime ?? "",
      reply: r.review?.reviewReply?.comment ? r.review.reviewReply.comment : null,
    }));
}

/** Publish an owner (merchant) reply to a review. */
export async function replyToGbpReview(
  accessToken: string,
  locationResource: string,
  reviewId: string,
  comment: string,
): Promise<void> {
  await gbpFetch(accessToken, `/${locationResource}/reviews/${reviewId}`, {
    method: "PUT",
    body: JSON.stringify({ comment }),
  });
}
