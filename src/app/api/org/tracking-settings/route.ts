import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

function isSupabaseConfigured(): boolean {
  return (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").startsWith("http");
}

// gtm_container_id/ga4_measurement_id/ga4_api_secret/meta_pixel_id are
// deliberately excluded from the authenticated column-grant on
// `organizations` (same pattern as white_label_enabled/white_label_name) —
// set via the service-role client after an explicit owner/admin-role check
// here, not a direct client write.
export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return Response.json({ error: "Not available yet" }, { status: 400 });
  }

  let body: {
    orgId?: string;
    gtmContainerId?: string;
    ga4MeasurementId?: string;
    ga4ApiSecret?: string;
    metaPixelId?: string;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { orgId, gtmContainerId, ga4MeasurementId, ga4ApiSecret, metaPixelId } = body;
  if (!orgId) return Response.json({ error: "orgId is required" }, { status: 400 });

  if (gtmContainerId?.trim() && !/^GTM-[A-Z0-9]+$/i.test(gtmContainerId.trim())) {
    return Response.json({ error: "GTM Container ID should look like GTM-XXXXXXX" }, { status: 400 });
  }
  if (ga4MeasurementId?.trim() && !/^G-[A-Z0-9]+$/i.test(ga4MeasurementId.trim())) {
    return Response.json({ error: "GA4 Measurement ID should look like G-XXXXXXXXXX" }, { status: 400 });
  }
  if (metaPixelId?.trim() && !/^\d{10,20}$/.test(metaPixelId.trim())) {
    return Response.json({ error: "Meta Pixel ID should be a 10-20 digit number" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });

  const { data: membership } = await supabase
    .from("org_members")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
    return Response.json({ error: "Only the owner or an admin can change tracking settings" }, { status: 403 });
  }

  const update: Database["public"]["Tables"]["organizations"]["Update"] = {
    gtm_container_id: gtmContainerId?.trim() || null,
    ga4_measurement_id: ga4MeasurementId?.trim() || null,
    meta_pixel_id: metaPixelId?.trim() || null,
  };
  // Only touch the secret if the caller actually sent a new value — an
  // untouched field in the UI never reaches the request body at all (see
  // TrackingSettingsSection), so a blank save never wipes an existing one.
  if (ga4ApiSecret?.trim()) update.ga4_api_secret = ga4ApiSecret.trim();

  const admin = createAdminClient();
  const { error } = await admin.from("organizations").update(update).eq("id", orgId);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ success: true });
}
