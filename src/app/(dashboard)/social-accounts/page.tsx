import SocialAccountsView from "@/components/social-accounts/SocialAccountsView";
import { createClient } from "@/lib/supabase/server";
import { getUserOrgs } from "@/lib/supabase/organizations";
import { resolveActiveOrg } from "@/lib/supabase/activeOrg";
import type { SocialAccount } from "@/types/database";

async function getPageData(): Promise<{ orgId: string | null; accounts: SocialAccount[] }> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (!supabaseUrl.startsWith("http")) return { orgId: null, accounts: [] };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { orgId: null, accounts: [] };

  const orgs = await getUserOrgs(supabase, user.id);
  const org = await resolveActiveOrg(orgs);
  if (!org) return { orgId: null, accounts: [] };

  const { data } = await supabase.from("social_accounts").select("*").eq("org_id", org.id).eq("is_active", true);
  return { orgId: org.id, accounts: data ?? [] };
}

export default async function SocialAccountsPage({ searchParams }: { searchParams: Promise<{ connected?: string; error?: string }> }) {
  const { orgId, accounts } = await getPageData();
  const params = await searchParams;
  return <SocialAccountsView orgId={orgId} initialAccounts={accounts} connected={params.connected ?? null} error={params.error ?? null} />;
}
