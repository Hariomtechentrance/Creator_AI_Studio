import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rejectContentPost } from "@/lib/supabase/content";

export async function POST(_request: NextRequest, ctx: RouteContext<"/api/content-posts/[id]/reject">) {
  const { id } = await ctx.params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });

  const { data: post } = await supabase.from("content_posts").select("id, status").eq("id", id).single();
  if (!post) return Response.json({ error: "Post not found" }, { status: 404 });
  if (post.status !== "pending_approval") {
    return Response.json({ error: `Post is "${post.status}", not pending approval` }, { status: 409 });
  }

  const { error } = await rejectContentPost(supabase, id);
  if (error) return Response.json({ error }, { status: 500 });

  return Response.json({ ok: true });
}
