import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { saveVideoPost } from "@/lib/supabase/content";
import type { ContentPost } from "@/types/database";

export async function POST(request: NextRequest) {
  let body: { orgId?: string; topic?: string; caption?: string; hashtags?: string[]; platforms?: string[]; videoUrl?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { orgId, topic, caption, videoUrl } = body;
  const hashtags = body.hashtags ?? [];
  const platforms = (body.platforms ?? []) as ContentPost["platforms"];
  if (!orgId || !topic || !videoUrl) {
    return Response.json({ error: "orgId, topic, and videoUrl are required" }, { status: 400 });
  }
  if (!platforms.length) {
    return Response.json({ error: "Pick at least one platform to publish to" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });

  const { data: membership } = await supabase
    .from("org_members")
    .select("id")
    .eq("org_id", orgId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) return Response.json({ error: "Not a member of this organization" }, { status: 403 });

  const { post, error } = await saveVideoPost(supabase, orgId, user.id, { topic, caption: caption ?? "", hashtags, platforms, videoUrl });
  if (error || !post) return Response.json({ error: error ?? "Couldn't save the post" }, { status: 500 });

  return Response.json({ post });
}
