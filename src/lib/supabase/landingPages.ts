import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, LandingPage } from "@/types/database";
import type { GeneratedLandingPage, LandingPageSection } from "@/lib/ai/landingPage";

export interface AbVariant {
  headline: string;
  subheadline: string;
  ctaText: string;
}

export interface AbTestConfig {
  enabled: boolean;
  variantB?: AbVariant;
  stats?: {
    a: { views: number; conversions: number };
    b: { views: number; conversions: number };
  };
}

export function parseAbTest(page: LandingPage): AbTestConfig {
  const raw = page.ab_test as unknown as AbTestConfig | null;
  return raw && typeof raw === "object" ? raw : { enabled: false };
}

export async function getLandingPages(supabase: SupabaseClient<Database>, orgId: string): Promise<LandingPage[]> {
  const { data } = await supabase.from("landing_pages").select("*").eq("org_id", orgId).order("created_at", { ascending: false });
  return data ?? [];
}

function slugify(title: string): string {
  return `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40)}-${Math.random().toString(36).slice(2, 6)}`;
}

export async function createLandingPage(
  supabase: SupabaseClient<Database>,
  orgId: string,
  createdBy: string,
  generated: GeneratedLandingPage,
): Promise<{ page: LandingPage | null; error: string | null }> {
  const { data, error } = await supabase
    .from("landing_pages")
    .insert({
      org_id: orgId,
      slug: slugify(generated.title),
      title: generated.title,
      headline: generated.headline,
      subheadline: generated.subheadline,
      sections: generated.sections as unknown as Database["public"]["Tables"]["landing_pages"]["Row"]["sections"],
      cta_text: generated.ctaText,
      created_by: createdBy,
    })
    .select("*")
    .single();

  return { page: data, error: error?.message ?? null };
}

export async function togglePublish(
  supabase: SupabaseClient<Database>,
  pageId: string,
  publish: boolean,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("landing_pages")
    .update({ status: publish ? "published" : "draft", published_at: publish ? new Date().toISOString() : null })
    .eq("id", pageId);
  return { error: error?.message ?? null };
}

export async function deleteLandingPage(supabase: SupabaseClient<Database>, pageId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from("landing_pages").delete().eq("id", pageId);
  return { error: error?.message ?? null };
}

export async function updateLandingPageContent(
  supabase: SupabaseClient<Database>,
  pageId: string,
  content: { headline: string; subheadline: string | null; ctaText: string; sections: LandingPageSection[] },
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("landing_pages")
    .update({
      headline: content.headline,
      subheadline: content.subheadline,
      cta_text: content.ctaText,
      sections: content.sections as unknown as Database["public"]["Tables"]["landing_pages"]["Row"]["sections"],
    })
    .eq("id", pageId);
  return { error: error?.message ?? null };
}

export async function updateAbTest(
  supabase: SupabaseClient<Database>,
  pageId: string,
  abTest: AbTestConfig,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("landing_pages")
    .update({ ab_test: abTest as unknown as Database["public"]["Tables"]["landing_pages"]["Row"]["ab_test"] })
    .eq("id", pageId);
  return { error: error?.message ?? null };
}
