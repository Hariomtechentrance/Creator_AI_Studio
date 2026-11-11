import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  let body: { orgId?: string; imageDataUrl?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { orgId, imageDataUrl } = body;
  if (!orgId || !imageDataUrl) return Response.json({ error: "orgId and imageDataUrl are required" }, { status: 400 });

  const match = imageDataUrl.match(/^data:(image\/(?:png|jpeg|webp));base64,(.*)$/);
  if (!match) return Response.json({ error: "Image must be a PNG, JPEG, or WEBP data URL" }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });

  const { data: membership } = await supabase.from("org_members").select("id").eq("org_id", orgId).eq("user_id", user.id).maybeSingle();
  if (!membership) return Response.json({ error: "Not a member of this organization" }, { status: 403 });

  const [, mimeType, base64] = match;
  const ext = mimeType.split("/")[1];
  const path = `${orgId}/ad-creative-${Date.now()}.${ext}`;

  const admin = createAdminClient();
  const { error } = await admin.storage.from("brand-logos").upload(path, Buffer.from(base64, "base64"), { contentType: mimeType, upsert: false });
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const { data } = admin.storage.from("brand-logos").getPublicUrl(path);
  return Response.json({ imageUrl: data.publicUrl });
}
