import BrandKitView from "@/components/brand-kit/BrandKitView";
import { createClient } from "@/lib/supabase/server";
import { getUserOrgs } from "@/lib/supabase/organizations";
import { resolveActiveOrg } from "@/lib/supabase/activeOrg";
import { getBrandProfile } from "@/lib/supabase/brand";
import type { Organization, BrandProfile } from "@/types/database";

async function getPageData(): Promise<{ org: Organization | null; brandProfile: BrandProfile | null }> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (!supabaseUrl.startsWith("http")) return { org: null, brandProfile: null };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { org: null, brandProfile: null };

  const orgs = await getUserOrgs(supabase, user.id);
  const org = await resolveActiveOrg(orgs);
  if (!org) return { org: null, brandProfile: null };

  const brandProfile = await getBrandProfile(supabase, org.id);
  return { org, brandProfile };
}

export default async function BrandKitPage() {
  const { org, brandProfile } = await getPageData();
  return <BrandKitView org={org} brandProfile={brandProfile} />;
}
