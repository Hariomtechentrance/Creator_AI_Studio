import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyOrgMembers } from "@/lib/supabase/notifications-server";
import { runAutomations } from "@/lib/automations/engine";

function isSupabaseConfigured(): boolean {
  return (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").startsWith("http");
}

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return Response.json({ error: "Notifications aren't available yet" }, { status: 400 });
  }

  let body: { leadId?: string; orgId?: string; leadName?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { leadId, orgId, leadName } = body;
  if (!leadId || !orgId) {
    return Response.json({ error: "leadId and orgId are required" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Sign in required" }, { status: 401 });
  }

  const { data: membership } = await supabase
    .from("org_members")
    .select("id")
    .eq("org_id", orgId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) {
    return Response.json({ error: "Not a member of this organization" }, { status: 403 });
  }

  await notifyOrgMembers(
    orgId,
    { type: "new_lead", title: `New lead: ${leadName || "Unnamed"}`, data: { leadId } },
    user.id,
  );

  // Fire-and-forget automations — a failed automation shouldn't fail the
  // notification response the client is waiting on.
  const admin = createAdminClient();
  const { data: lead } = await admin.from("leads").select("*").eq("id", leadId).single();
  if (lead) {
    runAutomations(admin, orgId, "lead_created", lead).catch(() => {});
  }

  return Response.json({ success: true });
}
