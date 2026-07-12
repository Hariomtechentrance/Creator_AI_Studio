import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseAbTest } from "@/lib/supabase/landingPages";
import LandingPageForm from "@/components/landing-pages/LandingPageForm";
import type { LandingPageSection } from "@/lib/ai/landingPage";

export default async function PublicLandingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (!supabaseUrl.startsWith("http")) notFound();

  const admin = createAdminClient();
  const { data: page } = await admin
    .from("landing_pages")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .single();

  if (!page) notFound();

  const sections = (page.sections ?? []) as unknown as LandingPageSection[];
  const abTest = parseAbTest(page);

  // Variant is assigned per-visitor (sticky via cookie) in proxy.ts, which
  // is where a response cookie can actually be set for this request — a
  // plain Server Component can only read cookies, not set them.
  const headerStore = await headers();
  const assignedVariant = headerStore.get("x-lp-variant");
  const variant: "a" | "b" = abTest.enabled && abTest.variantB && assignedVariant === "b" ? "b" : "a";
  await admin.rpc("increment_ab_stat", { p_page_id: page.id, p_variant: variant, p_kind: "views" });

  const headline = variant === "b" && abTest.variantB ? abTest.variantB.headline : page.headline;
  const subheadline = variant === "b" && abTest.variantB ? abTest.variantB.subheadline : page.subheadline;
  const ctaText = variant === "b" && abTest.variantB ? abTest.variantB.ctaText : page.cta_text;

  return (
    <div style={{ background: "#0a0a0f", minHeight: "100vh", color: "white" }}>
      <div className="max-w-2xl mx-auto px-6 py-20 space-y-14">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-black">{headline}</h1>
          {subheadline && <p className="text-lg" style={{ color: "#a1a1aa" }}>{subheadline}</p>}
        </div>

        <LandingPageForm slug={slug} pageId={page.id} variant={variant} ctaText={ctaText} />

        <div className="space-y-10">
          {sections.map((s, i) => (
            <div key={i}>
              <h2 className="text-xl font-bold mb-2">{s.heading}</h2>
              <p style={{ color: "#a1a1aa" }}>{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
