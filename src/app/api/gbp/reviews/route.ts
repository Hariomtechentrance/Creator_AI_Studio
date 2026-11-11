import type { NextRequest } from "next/server";
import { getGbpContext } from "@/lib/social/gbpServerContext";
import { fetchGbpReviews } from "@/lib/social/googleBusinessProfile";

export const maxDuration = 30;

// Lists the connected profile's reviews with each one's existing owner reply,
// so the UI can show "unanswered" and pre-fill the reply box.
export async function GET(request: NextRequest) {
  const accountId = request.nextUrl.searchParams.get("accountId");
  if (!accountId) return Response.json({ error: "accountId is required" }, { status: 400 });

  const resolved = await getGbpContext(accountId);
  if (!resolved.ok) return Response.json({ error: resolved.error }, { status: resolved.status });

  try {
    const reviews = await fetchGbpReviews(resolved.ctx.accessToken, resolved.ctx.locationResource);
    const unanswered = reviews.filter((r) => !r.reply).length;
    return Response.json({ reviews, unanswered });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Couldn't load reviews" }, { status: 502 });
  }
}
