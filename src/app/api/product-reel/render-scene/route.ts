import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { uploadContentMedia } from "@/lib/supabase/storage";
import { generateWithKenBurns } from "@/lib/video/kenBurns";

export const maxDuration = 120;

function isSupabaseConfigured(): boolean {
  return (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").startsWith("http");
}

export async function POST(request: NextRequest) {
  let body: { imageDataUrl?: string; camera?: string; durationSeconds?: number; orgId?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { imageDataUrl, camera = "None", durationSeconds = 5, orgId } = body;
  if (!imageDataUrl) return Response.json({ error: "A product photo is required for this scene" }, { status: 400 });
  if (!orgId) return Response.json({ error: "orgId is required" }, { status: 400 });

  const authEnabled = isSupabaseConfigured();
  let userId: string | null = null;

  if (authEnabled) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Sign in to render a scene" }, { status: 401 });
    userId = user.id;

    const { data: membership } = await supabase
      .from("org_members")
      .select("id")
      .eq("org_id", orgId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!membership) return Response.json({ error: "Not a member of this organization" }, { status: 403 });
  }

  try {
    const dataUrl = await generateWithKenBurns(imageDataUrl, durationSeconds, camera);

    if (!authEnabled) throw new Error("Storage isn't configured — can't save the rendered scene");
    const match = dataUrl.match(/^data:(.+);base64,(.*)$/);
    if (!match) throw new Error("Ken Burns render returned invalid data");
    const admin = createAdminClient();
    const { url, error: uploadError } = await uploadContentMedia(admin, orgId, Buffer.from(match[2], "base64"), match[1], "mp4");
    if (uploadError || !url) throw new Error(uploadError ?? "Upload failed");

    return Response.json({ videoUrl: url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Scene render failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
