import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isHeyGenConfigured, uploadImageAsset } from "@/lib/ai/heygen";

export const maxDuration = 60;

function isSupabaseConfigured(): boolean {
  return (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").startsWith("http");
}

async function resolveImageBytes(imageUrlOrDataUrl: string): Promise<{ bytes: Buffer; mimeType: string }> {
  const dataUrlMatch = imageUrlOrDataUrl.match(/^data:(.+);base64,(.*)$/);
  if (dataUrlMatch) {
    return { bytes: Buffer.from(dataUrlMatch[2], "base64"), mimeType: dataUrlMatch[1] };
  }
  const res = await fetch(imageUrlOrDataUrl);
  if (!res.ok) throw new Error(`Couldn't fetch the face image (${res.status})`);
  const mimeType = res.headers.get("content-type") ?? "image/png";
  const bytes = Buffer.from(await res.arrayBuffer());
  return { bytes, mimeType };
}

export async function POST(request: NextRequest) {
  if (!isHeyGenConfigured()) {
    return Response.json({ error: "AI Video Pipeline needs HEYGEN_API_KEY configured in .env.local" }, { status: 400 });
  }

  let body: { imageUrlOrDataUrl?: string; orgId?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { imageUrlOrDataUrl, orgId } = body;
  if (!imageUrlOrDataUrl) return Response.json({ error: "imageUrlOrDataUrl is required" }, { status: 400 });

  const authEnabled = isSupabaseConfigured();
  let userId: string | null = null;

  if (authEnabled) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Sign in to register a face" }, { status: 401 });
    userId = user.id;

    if (orgId) {
      const { data: membership } = await supabase
        .from("org_members")
        .select("id")
        .eq("org_id", orgId)
        .eq("user_id", userId)
        .maybeSingle();
      if (!membership) return Response.json({ error: "Not a member of this organization" }, { status: 403 });
    }
  }

  try {
    const { bytes, mimeType } = await resolveImageBytes(imageUrlOrDataUrl);
    const { assetId, url } = await uploadImageAsset(bytes, mimeType);

    if (authEnabled && userId) {
      const admin = createAdminClient();
      await admin.from("generations").insert({
        user_id: userId,
        type: "custom_avatar",
        prompt: "Face registered as HeyGen asset",
        model: "heygen",
        status: "completed",
        output_urls: url ? [url] : [],
        settings: { assetId },
        credits_used: 0,
      });
    }

    return Response.json({ assetId, url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Couldn't register the face image";
    return Response.json({ error: message }, { status: 500 });
  }
}
