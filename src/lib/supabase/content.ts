import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, ContentPost } from "@/types/database";
import type { PlatformContent } from "@/lib/ai/contentGeneration";

export async function getContentPosts(supabase: SupabaseClient<Database>, orgId: string): Promise<ContentPost[]> {
  const { data } = await supabase
    .from("content_posts")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function saveGeneratedPost(
  supabase: SupabaseClient<Database>,
  orgId: string,
  createdBy: string,
  input: { topic: string; contentType: string; variations: PlatformContent[] },
): Promise<{ post: ContentPost | null; error: string | null }> {
  const primary = input.variations[0];
  const { data, error } = await supabase
    .from("content_posts")
    .insert({
      org_id: orgId,
      title: input.topic.slice(0, 80),
      caption: primary?.caption ?? null,
      hashtags: primary?.hashtags ?? [],
      keywords: [],
      call_to_action: primary?.cta ?? null,
      media_type: "image",
      media_urls: [],
      thumbnail_url: null,
      platforms: input.variations.map((v) => v.platform) as ContentPost["platforms"],
      platform_versions: Object.fromEntries(input.variations.map((v) => [v.platform, v])) as unknown as Database["public"]["Tables"]["content_posts"]["Row"]["platform_versions"],
      post_type: "organic",
      campaign_id: null,
      ai_generated: true,
      original_prompt: input.topic,
      ai_model_used: "claude-opus-4-8",
      approved_by: null,
      approved_at: null,
      scheduled_at: null,
      published_at: null,
      performance_last_synced: null,
      created_by: createdBy,
    })
    .select("*")
    .single();

  return { post: data, error: error?.message ?? null };
}

export async function getPendingApprovalPosts(supabase: SupabaseClient<Database>, orgId: string): Promise<ContentPost[]> {
  const { data } = await supabase
    .from("content_posts")
    .select("*")
    .eq("org_id", orgId)
    .eq("status", "pending_approval")
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function saveVideoPost(
  supabase: SupabaseClient<Database>,
  orgId: string,
  createdBy: string,
  input: { topic: string; caption: string; hashtags: string[]; platforms: ContentPost["platforms"]; videoUrl: string },
): Promise<{ post: ContentPost | null; error: string | null }> {
  const { data, error } = await supabase
    .from("content_posts")
    .insert({
      org_id: orgId,
      title: input.topic.slice(0, 80),
      caption: input.caption,
      hashtags: input.hashtags,
      keywords: [],
      call_to_action: null,
      media_type: "video",
      media_urls: [input.videoUrl],
      thumbnail_url: null,
      platforms: input.platforms,
      platform_versions: {} as unknown as Database["public"]["Tables"]["content_posts"]["Row"]["platform_versions"],
      post_type: "organic",
      campaign_id: null,
      ai_generated: true,
      original_prompt: input.topic,
      ai_model_used: "claude-opus-4-8 + heygen + replicate",
      status: "pending_approval",
      approved_by: null,
      approved_at: null,
      scheduled_at: null,
      published_at: null,
      performance_last_synced: null,
      created_by: createdBy,
    })
    .select("*")
    .single();

  return { post: data, error: error?.message ?? null };
}

export async function approveContentPost(
  supabase: SupabaseClient<Database>,
  postId: string,
  approvedBy: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("content_posts")
    .update({ status: "approved", approved_by: approvedBy, approved_at: new Date().toISOString() })
    .eq("id", postId)
    .eq("status", "pending_approval");
  return { error: error?.message ?? null };
}

export async function rejectContentPost(supabase: SupabaseClient<Database>, postId: string): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("content_posts")
    .update({ status: "rejected" })
    .eq("id", postId)
    .eq("status", "pending_approval");
  return { error: error?.message ?? null };
}

export async function scheduleContentPost(
  supabase: SupabaseClient<Database>,
  postId: string,
  scheduledAt: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("content_posts")
    .update({ status: "scheduled", scheduled_at: scheduledAt })
    .eq("id", postId);
  return { error: error?.message ?? null };
}

export async function deleteContentPost(supabase: SupabaseClient<Database>, postId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from("content_posts").delete().eq("id", postId);
  return { error: error?.message ?? null };
}
