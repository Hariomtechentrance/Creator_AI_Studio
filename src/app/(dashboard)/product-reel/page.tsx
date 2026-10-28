import ProductReelView from "@/components/product-reel/ProductReelView";
import { createClient } from "@/lib/supabase/server";
import { getUserOrgs } from "@/lib/supabase/organizations";
import { resolveActiveOrg } from "@/lib/supabase/activeOrg";
import type { SocialAccount } from "@/types/database";

async function getPageData(): Promise<{ orgId: string | null; connectedPlatforms: SocialAccount["platform"][] }> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (!supabaseUrl.startsWith("http")) return { orgId: null, connectedPlatforms: [] };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { orgId: null, connectedPlatforms: [] };

  const orgs = await getUserOrgs(supabase, user.id);
  const org = await resolveActiveOrg(orgs);
  if (!org) return { orgId: null, connectedPlatforms: [] };

  const { data } = await supabase.from("social_accounts").select("platform").eq("org_id", org.id).eq("is_active", true);
  return { orgId: org.id, connectedPlatforms: (data ?? []).map((a) => a.platform) };
}

export default async function ProductReelPage() {
  const { orgId, connectedPlatforms } = await getPageData();
  return <ProductReelView orgId={orgId} connectedPlatforms={connectedPlatforms} />;
}
