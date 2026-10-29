import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { publishContentPost, applyPublishResults, type PublishResults } from "@/lib/social/publish";

export const maxDuration = 300; // video posts poll until the provider finishes processing

// This is the missing half of "Schedule Post": the UI writes rows with
// status='scheduled' + scheduled_at, but nothing used to fire them. This route
// is a cron-driven worker that publishes anything whose scheduled time has
// arrived. It runs with the service-role client (no user session), so it MUST
// be protected by CRON_SECRET — otherwise anyone could trigger publishes.

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  // Vercel Cron automatically sends `Authorization: Bearer ${CRON_SECRET}`.
  const auth = request.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  // Render/PM2/curl schedulers: pass the shared secret explicitly.
  return request.headers.get("x-cron-secret") === secret;
}

async function runScheduledPublishes() {
  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { data: due, error } = await admin
    .from("content_posts")
    .select("*")
    .eq("status", "scheduled")
    .not("scheduled_at", "is", null)
    .lte("scheduled_at", now);

  if (error) throw error;
  const posts = due ?? [];
  const summary: { postId: string; results: PublishResults }[] = [];

  for (const post of posts) {
    // Optimistically claim the row so a slow publish (video polling) can't be
    // double-fired by an overlapping cron tick.
    await admin.from("content_posts").update({ status: "publishing" }).eq("id", post.id).eq("status", "scheduled");

    const { data: accounts } = await admin
      .from("social_accounts")
      .select("*")
      .eq("org_id", post.org_id)
      .eq("is_active", true);

    const results = await publishContentPost(post, accounts ?? []);
    // applyPublishResults flips to published/failed only if at least one
    // platform succeeded; mark failed explicitly when none did, so the post
    // leaves the 'publishing' limbo and doesn't get retried forever.
    await applyPublishResults(admin, post.id, results);
    const anySucceeded = Object.values(results).some((r) => r.success);
    if (!anySucceeded) {
      await admin.from("content_posts").update({ status: "failed" }).eq("id", post.id).eq("status", "publishing");
    }

    summary.push({ postId: post.id, results });
  }

  return { attempted: posts.length, published: summary };
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    return Response.json(await runScheduledPublishes());
  } catch (err) {
    const message = err instanceof Error ? err.message : "Scheduled publish run failed";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
