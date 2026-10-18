import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, ContentPost, SocialAccount } from "@/types/database";
import { postToFacebookPage, postToInstagram } from "@/lib/social/meta";
import { postToLinkedIn } from "@/lib/social/linkedin";

export type PublishResults = Record<string, { success: boolean; error?: string; id?: string }>;

/**
 * Per-platform publish dispatch, extracted unchanged from what was inline in
 * POST /api/social/publish so both the manual "Publish Now" button and the
 * approve-and-auto-publish flow share one implementation.
 */
export async function publishContentPost(post: ContentPost, accounts: SocialAccount[]): Promise<PublishResults> {
  const results: PublishResults = {};
  const isVideo = post.media_type === "video";
  const mediaUrl = post.media_urls[0];

  for (const platform of post.platforms) {
    const account = accounts.find((a) => a.platform === platform);
    if (!account || !account.access_token) {
      results[platform] = { success: false, error: "Not connected" };
      continue;
    }

    try {
      if (platform === "facebook") {
        const id = isVideo
          ? await postToFacebookPage(account.account_id, account.access_token, post.caption ?? "", undefined, mediaUrl)
          : await postToFacebookPage(account.account_id, account.access_token, post.caption ?? "", mediaUrl);
        results[platform] = { success: true, id };
      } else if (platform === "instagram") {
        if (!mediaUrl) throw new Error(`Instagram requires ${isVideo ? "a video" : "an image"} — this post has none`);
        const id = await postToInstagram(account.account_id, account.access_token, mediaUrl, post.caption ?? "", isVideo ? "video" : "image");
        results[platform] = { success: true, id };
      } else if (platform === "linkedin") {
        const id = await postToLinkedIn(account.account_id, account.access_token, post.caption ?? "", mediaUrl, isVideo ? "video" : "image");
        results[platform] = { success: true, id };
      } else {
        results[platform] = { success: false, error: "Publishing not built for this platform yet" };
      }
    } catch (err) {
      results[platform] = { success: false, error: err instanceof Error ? err.message : "Publish failed" };
    }
  }

  return results;
}

/** Applies the same published/failed status update every publish path uses after dispatching. */
export async function applyPublishResults(
  supabase: SupabaseClient<Database>,
  postId: string,
  results: PublishResults,
): Promise<void> {
  const anySucceeded = Object.values(results).some((r) => r.success);
  if (!anySucceeded) return;

  const allSucceeded = Object.values(results).every((r) => r.success);
  const platformPostIds = Object.fromEntries(Object.entries(results).filter(([, r]) => r.success).map(([p, r]) => [p, r.id]));

  await supabase
    .from("content_posts")
    .update({
      status: allSucceeded ? "published" : "failed",
      published_at: new Date().toISOString(),
      platform_post_ids: platformPostIds as unknown as Database["public"]["Tables"]["content_posts"]["Row"]["platform_post_ids"],
    })
    .eq("id", postId);
}
