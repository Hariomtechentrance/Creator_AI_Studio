import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { publishContentPost, applyPublishResults } from "@/lib/social/publish";

export const maxDuration = 300; // video posts (Instagram Reels) poll until processed

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

  const results = await publishContentPost(post, accounts ?? []);
  await applyPublishResults(supabase, post.id, results);

  return Response.json({ results });
}
