import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { uploadContentMedia } from "@/lib/supabase/storage";
import { renderContactCardClip } from "@/lib/video/contactCard";

export const maxDuration = 60;

const ASPECT_DIMENSIONS: Record<string, { width: number; height: number }> = {
  "9:16": { width: 1080, height: 1920 },
  "16:9": { width: 1920, height: 1080 },
  "1:1": { width: 1080, height: 1080 },
  "4:5": { width: 1080, height: 1350 },
  "5:4": { width: 1350, height: 1080 },
};

export async function POST(request: NextRequest) {
  let body: { orgId?: string; aspectRatio?: string; durationSeconds?: number };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { orgId, durationSeconds = 4 } = body;
  if (!orgId) return Response.json({ error: "orgId is required" }, { status: 400 });
  const dims = ASPECT_DIMENSIONS[body.aspectRatio ?? "9:16"] ?? ASPECT_DIMENSIONS["9:16"];

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });

  const { data: membership } = await supabase.from("org_members").select("id").eq("org_id", orgId).eq("user_id", user.id).maybeSingle();
  if (!membership) return Response.json({ error: "Not a member of this organization" }, { status: 403 });

  const { data: org } = await supabase.from("organizations").select("name, website, logo_url").eq("id", orgId).single();
  if (!org) return Response.json({ error: "Organization not found" }, { status: 404 });

  const { data: brand } = await supabase.from("brand_profiles").select("brand_colors, business_type").eq("org_id", orgId).maybeSingle();

  try {
    const clip = await renderContactCardClip(
      {
        orgName: org.name,
        tagline: brand?.business_type ?? null,
        website: org.website,
        logoUrl: org.logo_url,
        brandColor: brand?.brand_colors?.[0] ?? null,
      },
      durationSeconds,
      dims.width,
      dims.height,
    );

    const admin = createAdminClient();
    const { url, error } = await uploadContentMedia(admin, orgId, clip, "video/mp4", "mp4");
    if (error || !url) throw new Error(error ?? "Upload failed");

    return Response.json({ videoUrl: url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Couldn't generate the contact card";
    return Response.json({ error: message }, { status: 500 });
  }
}
