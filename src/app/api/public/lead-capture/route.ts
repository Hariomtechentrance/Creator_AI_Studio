import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createLead } from "@/lib/supabase/leads";
import { notifyOrgMembers } from "@/lib/supabase/notifications-server";
import { runAutomations } from "@/lib/automations/engine";

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

  let body: { slug?: string; name?: string; email?: string; phone?: string; pageId?: string; variant?: "a" | "b" };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { slug, name, email, phone, pageId, variant } = body;
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

  return Response.json({ success: true });
}
