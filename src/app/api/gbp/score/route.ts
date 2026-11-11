import type { NextRequest } from "next/server";
import { getGbpContext } from "@/lib/social/gbpServerContext";
import { computeGbpScore } from "@/lib/seo/gbpScore";

export const maxDuration = 40; // scores several Google endpoints + fetches the website

// The 21-factor "how optimized is my Business Profile" score + ranked to-dos.
export async function GET(request: NextRequest) {
  const accountId = request.nextUrl.searchParams.get("accountId");
  if (!accountId) return Response.json({ error: "accountId is required" }, { status: 400 });

  const resolved = await getGbpContext(accountId);
  if (!resolved.ok) return Response.json({ error: resolved.error }, { status: resolved.status });

  try {
    const score = await computeGbpScore(resolved.ctx.accessToken, resolved.ctx.locationResource);
    return Response.json({ ...score, accountName: resolved.ctx.accountName });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Couldn't compute score" }, { status: 502 });
  }
}
