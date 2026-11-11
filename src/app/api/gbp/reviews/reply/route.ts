import type { NextRequest } from "next/server";
import { getGbpContext } from "@/lib/social/gbpServerContext";
import { replyToGbpReview } from "@/lib/social/googleBusinessProfile";

export const maxDuration = 30;

// Publishes an owner (merchant) reply to a single Google review — the fastest
// local-SEO win (factor #20: owner reply rate). One-click per review.
export async function POST(request: NextRequest) {
  let body: { accountId?: string; reviewId?: string; comment?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }
  if (!body.accountId || !body.reviewId || !body.comment) {
    return Response.json({ error: "accountId, reviewId and comment are required" }, { status: 400 });
  }
  const comment = body.comment.trim();
  if (!comment) return Response.json({ error: "Reply can't be empty" }, { status: 400 });
  // Google caps merchant replies at 4096 chars.
  if (comment.length > 4096) return Response.json({ error: "Reply is too long (max 4096 characters)" }, { status: 400 });

  const resolved = await getGbpContext(body.accountId);
  if (!resolved.ok) return Response.json({ error: resolved.error }, { status: resolved.status });

  try {
    await replyToGbpReview(resolved.ctx.accessToken, resolved.ctx.locationResource, body.reviewId, comment);
    return Response.json({ success: true });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Reply failed" }, { status: 502 });
  }
}
