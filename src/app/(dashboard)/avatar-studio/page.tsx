import AvatarStudioView from "@/components/avatar-studio/AvatarStudioView";
import { createClient } from "@/lib/supabase/server";
import { getUserOrgs } from "@/lib/supabase/organizations";
import { resolveActiveOrg } from "@/lib/supabase/activeOrg";

async function getPageData(): Promise<{ orgId: string | null }> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (!supabaseUrl.startsWith("http")) return { orgId: null };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { orgId: null };

  const orgs = await getUserOrgs(supabase, user.id);
  const org = await resolveActiveOrg(orgs);
  return { orgId: org?.id ?? null };
}

export default async function AvatarStudioPage() {
  const { orgId } = await getPageData();
  return <AvatarStudioView orgId={orgId} />;
}
