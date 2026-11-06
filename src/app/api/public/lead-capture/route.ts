import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createLead } from "@/lib/supabase/leads";
import { notifyOrgMembers } from "@/lib/supabase/notifications-server";
import { runAutomations } from "@/lib/automations/engine";
import { sendMetaLeadEvent } from "@/lib/social/metaConversions";
import { sendGa4Event, randomGa4ClientId } from "@/lib/analytics/ga4";

function isSupabaseConfigured(): boolean {
  return (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").startsWith("http");
}

/**
 * Public, unauthenticated endpoint — the lead form on a published landing
 * page (src/app/lp/[slug]) posts here. This is the real "Website forms"
 * lead source Module 3 deferred (no public caller existed until this
 * landing page builder shipped).
 */
export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return Response.json({ error: "Not available yet" }, { status: 400 });
  }

  let body: { slug?: string; name?: string; email?: string; phone?: string; pageId?: string; variant?: "a" | "b"; ga4ClientId?: string | null };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { slug, name, email, phone, pageId, variant, ga4ClientId } = body;
  if (!slug || (!email?.trim() && !phone?.trim())) {
    return Response.json({ error: "An email or phone number is required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: page } = await admin
    .from("landing_pages")
    .select("org_id, status")
    .eq("slug", slug)
    .single();

  if (!page || page.status !== "published") {
    return Response.json({ error: "This page isn't accepting submissions" }, { status: 404 });
  }

  if (pageId && (variant === "a" || variant === "b")) {
    await admin.rpc("increment_ab_stat", { p_page_id: pageId, p_variant: variant, p_kind: "conversions" });
  }

  const { lead, duplicate, error } = await createLead(admin, page.org_id, {
    name: name?.trim() || null,
    email: email?.trim() || null,
    phone: phone?.trim() || null,
    company: null,
    source: "website",
  });

  if (duplicate) {
    return Response.json({ success: true, message: "We already have your details — we'll be in touch." });
  }
  if (error || !lead) {
    return Response.json({ error: error ?? "Couldn't submit — try again" }, { status: 500 });
  }

  await notifyOrgMembers(page.org_id, {
    type: "new_lead",
    title: `New lead from landing page: ${lead.name || lead.email || "Unnamed"}`,
    data: { leadId: lead.id },
  });
  runAutomations(admin, page.org_id, "lead_created", lead).catch(() => {});

  // Fire-and-forget conversion events — a slow/failing ad-platform call
  // should never hold up or fail the visitor's form submission.
  reportLeadConversion(admin, page.org_id, {
    email: lead.email,
    phone: lead.phone,
    eventSourceUrl: request.headers.get("referer") ?? `${process.env.NEXT_PUBLIC_APP_URL}/lp/${slug}`,
    clientIp: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    userAgent: request.headers.get("user-agent"),
    ga4ClientId: ga4ClientId ?? null,
  }).catch(() => {});

  return Response.json({ success: true });
}

async function reportLeadConversion(
  admin: ReturnType<typeof createAdminClient>,
  orgId: string,
  info: { email: string | null; phone: string | null; eventSourceUrl: string; clientIp: string | null; userAgent: string | null; ga4ClientId: string | null },
): Promise<void> {
  const { data: org } = await admin
    .from("organizations")
    .select("meta_pixel_id, ga4_measurement_id, ga4_api_secret")
    .eq("id", orgId)
    .single();
  if (!org) return;

  if (org.meta_pixel_id) {
    const { data: accounts } = await admin
      .from("social_accounts")
      .select("access_token")
      .eq("org_id", orgId)
      .eq("platform", "meta_ads")
      .eq("is_active", true)
      .limit(1);
    const accessToken = accounts?.[0]?.access_token;
    if (accessToken) {
      await sendMetaLeadEvent({
        pixelId: org.meta_pixel_id,
        accessToken,
        email: info.email,
        phone: info.phone,
        eventSourceUrl: info.eventSourceUrl,
        clientIp: info.clientIp,
        userAgent: info.userAgent,
      });
    }
  }

  if (org.ga4_measurement_id && org.ga4_api_secret) {
    await sendGa4Event(
      org.ga4_measurement_id,
      org.ga4_api_secret,
      info.ga4ClientId ?? randomGa4ClientId(),
      "generate_lead",
      {},
    );
  }
}
