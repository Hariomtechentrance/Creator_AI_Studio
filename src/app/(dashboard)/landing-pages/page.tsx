import LandingPagesView from "@/components/landing-pages/LandingPagesView";
import { createClient } from "@/lib/supabase/server";
import { getUserOrgs } from "@/lib/supabase/organizations";
import { resolveActiveOrg } from "@/lib/supabase/activeOrg";
import { getLandingPages } from "@/lib/supabase/landingPages";
import type { LandingPage } from "@/types/database";

async function getPageData(): Promise<{ orgId: string | null; userId: string | null; pages: LandingPage[] }> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (!supabaseUrl.startsWith("http")) return { orgId: null, userId: null, pages: [] };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { orgId: null, userId: null, pages: [] };

  const orgs = await getUserOrgs(supabase, user.id);
  const org = await resolveActiveOrg(orgs);
  if (!org) return { orgId: null, userId: user.id, pages: [] };

  const pages = await getLandingPages(supabase, org.id);
  return { orgId: org.id, userId: user.id, pages };
}

export default async function LandingPagesPage() {
  const { orgId, userId, pages } = await getPageData();
  return <LandingPagesView orgId={orgId} userId={userId} initialPages={pages} />;
}
