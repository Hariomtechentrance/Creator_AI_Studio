import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

function isSupabaseConfigured(): boolean {
  return (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").startsWith("http");
}

// white_label_enabled/white_label_name are deliberately excluded from the
// authenticated column-grant on `organizations` (same pattern as
// owner_id/plan_tier in 005_brand_profile_and_org_lockdown.sql) — this is
// an agency-tier feature, so it's set via the service-role client after an
// explicit plan_tier + owner/admin-role check here.
export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return Response.json({ error: "Not available yet" }, { status: 400 });
  }

  let body: { orgId?: string; enabled?: boolean; name?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { orgId, enabled, name } = body;
  if (!orgId || typeof enabled !== "boolean") {
    return Response.json({ error: "orgId and enabled are required" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Sign in required" }, { status: 401 });
  }

  const { data: membership } = await supabase
    .from("org_members")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
    return Response.json({ error: "Only the owner or an admin can change white-label settings" }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data: org } = await admin.from("organizations").select("plan_tier").eq("id", orgId).single();
  if (!org || org.plan_tier !== "agency") {
    return Response.json({ error: "White-labeling needs the Agency plan" }, { status: 403 });
  }

  const { error } = await admin
    .from("organizations")
    .update({ white_label_enabled: enabled, white_label_name: name?.trim() || null })
    .eq("id", orgId);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ success: true });
}
