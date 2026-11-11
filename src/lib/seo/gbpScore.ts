// Google Business Profile "optimization score" — the read-only grader.
//
// There is NO official Google API that returns a "profile SEO score", so this is
// a transparent, weighted heuristic over the ranking factors that ARE readable
// from the GBP APIs plus a lightweight audit of the linked website's HTML.
// It outputs a 0-100 % and a ranked to-do list. It cannot guarantee a ranking
// (Google weighs relevance/distance/prominence), it only measures the parts of
// those that a profile owner can control.

import {
  fetchGbpLocation,
  fetchGbpAttributes,
  fetchGbpMediaCounts,
  fetchGbpReviews,
} from "@/lib/social/googleBusinessProfile";

export interface ScoreFactor {
  id: string;
  label: string;
  weight: number;
  passed: boolean;
  recommendation: string;
}

export interface GbpScore {
  score: number; // 0-100
  factors: ScoreFactor[];
  recommendations: string[]; // failed factors, ordered by weight desc
  stats: {
    reviewCount: number;
    unansweredReviews: number;
    averageRating: number;
    photos: number;
    videos: number;
    attributes: number;
    websiteChecked: boolean;
  };
}

// Off-profile / not-yet-readable factors surfaced purely as advice (0 weight —
// they inform the user but don't distort the measurable score).
const MANUAL_RECOMMENDATIONS = [
  "Post a Google Post (offer/event/update) at least weekly — cadence is a local-ranking signal.",
  "Add a booking/appointment link (with UTM) so Google can measure engagement actions.",
  "Keep Name/Address/Phone EXACTLY consistent with your website and directories (citations).",
  "Seed the Q&A section with the questions customers actually ask.",
];

function asString(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

async function auditWebsite(url: string): Promise<{ title: boolean; metaDescription: boolean; localBusinessSchema: boolean }> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(6000), headers: { "User-Agent": "CreatorAI-SEO-Audit/1.0" } });
    const html = (await res.text()).slice(0, 300_000);
    const lower = html.toLowerCase();
    return {
      title: /<title>[^<]{5,70}<\/title>/.test(lower),
      metaDescription: /<meta[^>]+name=["']description["'][^>]+content=["'].{20,}/.test(lower),
      localBusinessSchema:
        lower.includes("application/ld+json") &&
        /(localbusiness|"@type"\s*:\s*"hotel"|physician|store|optician|dentist|restaurant)/.test(lower),
    };
  } catch {
    return { title: false, metaDescription: false, localBusinessSchema: false };
  }
}

export async function computeGbpScore(accessToken: string, locationResource: string): Promise<GbpScore> {
  const [location, attributes, media, reviews] = await Promise.all([
    fetchGbpLocation(accessToken, locationResource),
    fetchGbpAttributes(accessToken, locationResource),
    fetchGbpMediaCounts(accessToken, locationResource),
    fetchGbpReviews(accessToken, locationResource),
  ]);

  const websiteUri = asString(location.websiteUri);
  const websiteAudit = websiteUri ? await auditWebsite(websiteUri) : null;

  const reviewCount = reviews.length || Number(location.reviewCount ?? 0);
  const averageRating = Number(location.averageRating ?? (reviewCount ? reviews.reduce((s, r) => s + r.starRating, 0) / reviewCount : 0));
  const unanswered = reviews.filter((r) => !r.reply).length;
  const answeredRate = reviewCount > 0 ? (reviewCount - unanswered) / reviewCount : 0;
  const latestReviewMs = reviews.reduce((max, r) => Math.max(max, r.publishTime ? Date.parse(r.publishTime) : 0), 0);
  const recencyDays = latestReviewMs ? (Date.now() - latestReviewMs) / 86_400_000 : Infinity;

  const businessHours = (location.metadata as Record<string, unknown> | undefined)?.businessHours as Record<string, unknown> | undefined;
  const hasHours = Array.isArray(businessHours?.periods) && (businessHours?.periods as unknown[]).length > 0;

  const categories = (location.categories ?? []) as unknown[];
  const address = location.address as unknown;

  const factors: ScoreFactor[] = [];
  const add = (id: string, label: string, weight: number, passed: boolean, recommendation: string) =>
    factors.push({ id, label, weight, passed, recommendation });

  add("primary_category", "Primary category set", 8, !!location.primaryCategory, "Set a precise primary category (biggest single lever).");
  add("secondary_categories", "Secondary categories", 4, categories.length >= 2, "Add relevant secondary categories.");
  add("phone", "Contact phone present", 4, !!asString((location.phoneNumbers as Record<string, unknown> | undefined)?.primaryPhone), "Add a verified local phone number.");
  add("website", "Website linked", 6, !!websiteUri, "Link your website URL.");
  add("hours", "Opening hours defined", 4, hasHours, "Fill in standard (and holiday) opening hours.");
  add("address", "Address / service area present", 3, !!address, "Add a service address or service areas.");
  add("attributes", "Business attributes (3+)", 5, attributes.length >= 3, "Tick attributes: accessibility, payments, amenities.");
  add("photos", "Photo count (10+)", 8, media.photos >= 10, `You have ${media.photos} photos — aim for 10+ (exterior, interior, team, product).`);
  add("video", "Video present", 4, media.videos >= 1, "Upload at least one short video to the profile.");
  add("review_volume", "Review count (10+)", 8, reviewCount >= 10, `Only ${reviewCount} reviews — actively request more.`);
  add("review_rating", "Average rating (4.0+)", 10, averageRating >= 4.0, `Rating is ${averageRating.toFixed(1)} — below the 4.0 threshold.`);
  add("review_recency", "Recent review (≤90 days)", 5, recencyDays <= 90, "No review in the last 90 days — keep review velocity steady.");
  add("reply_rate", "Reviews replied (≥80%)", 10, answeredRate >= 0.8, `${unanswered} unanswered review(s) — reply to every review.`);
  add("site_title", "Website has a proper <title>", 5, !!websiteAudit?.title, "Website title tag is missing or wrong length (50-60 chars).");
  add("site_meta", "Website has meta description", 4, !!websiteAudit?.metaDescription, "Add a 120-160 char meta description.");
  add("site_schema", "Website has LocalBusiness schema", 8, !!websiteAudit?.localBusinessSchema, "Add schema.org LocalBusiness/Hotel/Optical JSON-LD to the site.");

  const totalWeight = factors.reduce((s, f) => s + f.weight, 0);
  const earned = factors.reduce((s, f) => s + (f.passed ? f.weight : 0), 0);
  const score = Math.round((earned / totalWeight) * 100);

  const recommendations = factors
    .filter((f) => !f.passed)
    .sort((a, b) => b.weight - a.weight)
    .map((f) => f.recommendation)
    .concat(MANUAL_RECOMMENDATIONS);

  return {
    score,
    factors,
    recommendations,
    stats: {
      reviewCount,
      unansweredReviews: unanswered,
      averageRating: Math.round(averageRating * 10) / 10,
      photos: media.photos,
      videos: media.videos,
      attributes: attributes.length,
      websiteChecked: !!websiteAudit,
    },
  };
}
