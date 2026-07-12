import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { postToFacebookPage, postToInstagram } from "@/lib/social/meta";
import { postToLinkedIn } from "@/lib/social/linkedin";
import type { Database } from "@/types/database";

export async function POST(request: NextRequest) {
  let body: { postId?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }
  if (!body.postId) return Response.json({ error: "postId is required" }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });

  const { data: post } = await supabase.from("content_posts").select("*").eq("id", body.postId).single();
  if (!post) return Response.json({ error: "Post not found" }, { status: 404 });

  const { data: accounts } = await supabase.from("social_accounts").select("*").eq("org_id", post.org_id).eq("is_active", true);
  const results: Record<string, { success: boolean; error?: string; id?: string }> = {};
  const imageUrl = post.media_urls[0];

  for (const platform of post.platforms) {
    const account = (accounts ?? []).find((a) => a.platform === platform);
    if (!account || !account.access_token) {
      results[platform] = { success: false, error: "Not connected" };
      continue;
    }

    try {
      if (platform === "facebook") {
        const id = await postToFacebookPage(account.account_id, account.access_token, post.caption ?? "", imageUrl);
        results[platform] = { success: true, id };
      } else if (platform === "instagram") {
        if (!imageUrl) throw new Error("Instagram requires an image — this post has none");
        const id = await postToInstagram(account.account_id, account.access_token, imageUrl, post.caption ?? "");
        results[platform] = { success: true, id };
      } else if (platform === "linkedin") {
        const id = await postToLinkedIn(account.account_id, account.access_token, post.caption ?? "", imageUrl);
        results[platform] = { success: true, id };
      } else {
        results[platform] = { success: false, error: "Publishing not built for this platform yet" };
      }
    } catch (err) {
      results[platform] = { success: false, error: err instanceof Error ? err.message : "Publish failed" };
    }
  }

  const anySucceeded = Object.values(results).some((r) => r.success);
  const allSucceeded = Object.values(results).every((r) => r.success);

  if (anySucceeded) {
    const platformPostIds = Object.fromEntries(Object.entries(results).filter(([, r]) => r.success).map(([p, r]) => [p, r.id]));
    await supabase
      .from("content_posts")
      .update({
        status: allSucceeded ? "published" : "failed",
        published_at: new Date().toISOString(),
        platform_post_ids: platformPostIds as unknown as Database["public"]["Tables"]["content_posts"]["Row"]["platform_post_ids"],
      })
      .eq("id", post.id);
  }

  return Response.json({ results });
}
