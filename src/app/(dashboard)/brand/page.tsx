import BrandWizard from "@/components/brand/BrandWizard";
import { createClient } from "@/lib/supabase/server";
import { getUserOrgs } from "@/lib/supabase/organizations";
import { resolveActiveOrg } from "@/lib/supabase/activeOrg";
import { getBrandProfile } from "@/lib/supabase/brand";

async function getWizardData() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (!supabaseUrl.startsWith("http")) {
    return { orgId: null, orgInitial: null, brandInitial: null };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { orgId: null, orgInitial: null, brandInitial: null };
  }

  const orgs = await getUserOrgs(supabase, user.id);
  const org = await resolveActiveOrg(orgs);
  if (!org) {
    return { orgId: null, orgInitial: null, brandInitial: null };
  }

  const brandInitial = await getBrandProfile(supabase, org.id);

  return {
    orgId: org.id,
    orgInitial: { name: org.name, industry: org.industry ?? "", website: org.website ?? "", description: org.description ?? "" },
    brandInitial,
  };
}

export default async function BrandPage() {
  const { orgId, orgInitial, brandInitial } = await getWizardData();

  return <BrandWizard orgId={orgId} orgInitial={orgInitial} brandInitial={brandInitial} />;
}
