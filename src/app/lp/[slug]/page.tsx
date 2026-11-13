import { notFound } from "next/navigation";
import { headers } from "next/headers";
import Script from "next/script";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseAbTest } from "@/lib/supabase/landingPages";
import LandingPageForm, { type QualifyingField } from "@/components/landing-pages/LandingPageForm";
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

  // select("*") rather than naming the tracking columns — they only exist
  // once migration 017 has been applied, and this page must keep working
  // (just without tracking) for any environment where it hasn't been yet.
  const { data: org } = await admin
    .from("organizations")
    .select("*")
    .eq("id", page.org_id)
    .single();

  const sections = (page.sections ?? []) as unknown as LandingPageSection[];
  // Falls back to [] if migration 018 hasn't been applied yet in this environment.
  const qualifyingFields = ((page as unknown as { qualifying_fields?: QualifyingField[] }).qualifying_fields ?? []) as QualifyingField[];
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

  const gtmId = org?.gtm_container_id;
  const ga4Id = org?.ga4_measurement_id;
  const pixelId = org?.meta_pixel_id;

  return (
    <div style={{ background: "#0a0a0f", minHeight: "100vh", color: "white" }}>
      {gtmId && (
        <>
          <Script id="gtm-base" strategy="afterInteractive">
            {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtmId}');`}
          </Script>
          <noscript>
            <iframe src={`https://www.googletagmanager.com/ns.html?id=${gtmId}`} height="0" width="0" style={{ display: "none", visibility: "hidden" }} />
          </noscript>
        </>
      )}
      {/* GA4 loaded directly only when there's no GTM — a GTM setup should fire GA4 as a tag inside GTM itself, not duplicate pageviews here. */}
      {ga4Id && !gtmId && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${ga4Id}`} strategy="afterInteractive" />
          <Script id="ga4-base" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${ga4Id}');`}
          </Script>
        </>
      )}
      {pixelId && (
        <Script id="meta-pixel-base" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${pixelId}');fbq('track','PageView');`}
        </Script>
      )}

      <div className="max-w-2xl mx-auto px-6 py-20 space-y-14">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-black">{headline}</h1>
          {subheadline && <p className="text-lg" style={{ color: "#a1a1aa" }}>{subheadline}</p>}
        </div>

        <LandingPageForm slug={slug} pageId={page.id} variant={variant} ctaText={ctaText} trackingEnabled={!!(gtmId || ga4Id || pixelId)} qualifyingFields={qualifyingFields} />

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
