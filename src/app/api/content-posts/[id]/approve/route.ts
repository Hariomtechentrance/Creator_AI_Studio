import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { approveContentPost } from "@/lib/supabase/content";
import { publishContentPost, applyPublishResults } from "@/lib/social/publish";

export const maxDuration = 300; // video posts (Instagram Reels) poll until processed

export async function POST(_request: NextRequest, ctx: RouteContext<"/api/content-posts/[id]/approve">) {
  const { id } = await ctx.params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });

  // RLS (org_access_content_posts) already scopes this select to orgs the
  // user belongs to — a non-member gets null here, not another org's post.
  const { data: post } = await supabase.from("content_posts").select("*").eq("id", id).single();
  if (!post) return Response.json({ error: "Post not found" }, { status: 404 });
  if (post.status !== "pending_approval") {
    return Response.json({ error: `Post is "${post.status}", not pending approval` }, { status: 409 });
  }

  const { error: approveError } = await approveContentPost(supabase, id, user.id);
  if (approveError) return Response.json({ error: approveError }, { status: 500 });

  const { data: accounts } = await supabase.from("social_accounts").select("*").eq("org_id", post.org_id).eq("is_active", true);
  const results = await publishContentPost(post, accounts ?? []);
  await applyPublishResults(supabase, post.id, results);

  return Response.json({ results });
}
