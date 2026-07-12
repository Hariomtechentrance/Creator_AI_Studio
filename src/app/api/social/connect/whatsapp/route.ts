import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verifyWhatsAppNumber } from "@/lib/social/whatsapp";

/**
 * WhatsApp Business Cloud API has no standard OAuth consent screen for
 * third-party apps the way Meta/LinkedIn/Google do — businesses generate a
 * permanent access token via a System User in Meta Business Suite and paste
 * it in manually. This validates the pair by fetching the number's display
 * info before storing it.
 */
export async function POST(request: NextRequest) {
  let body: { orgId?: string; phoneNumberId?: string; accessToken?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { orgId, phoneNumberId, accessToken } = body;
  if (!orgId || !phoneNumberId?.trim() || !accessToken?.trim()) {
    return Response.json({ error: "orgId, phoneNumberId, and accessToken are required" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });

  const { data: membership } = await supabase.from("org_members").select("id").eq("org_id", orgId).eq("user_id", user.id).maybeSingle();
  if (!membership) return Response.json({ error: "Not a member of this organization" }, { status: 403 });

  try {
    const { displayNumber, verifiedName } = await verifyWhatsAppNumber(phoneNumberId.trim(), accessToken.trim());

    await supabase.from("social_accounts").upsert(
      {
        org_id: orgId,
        platform: "whatsapp",
        account_id: phoneNumberId.trim(),
        account_name: verifiedName,
        account_username: displayNumber,
        account_avatar: null,
        account_type: "business",
        access_token: accessToken.trim(),
        refresh_token: null,
        token_expires_at: null,
        scopes: [],
        is_active: true,
        last_synced_at: new Date().toISOString(),
        follower_count: 0,
        following_count: 0,
        post_count: 0,
      },
      { onConflict: "org_id,platform,account_id" },
    );

    return Response.json({ success: true, displayNumber, verifiedName });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Couldn't connect that number";
    return Response.json({ error: message }, { status: 400 });
  }
}
