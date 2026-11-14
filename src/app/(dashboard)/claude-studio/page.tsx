import ClaudeStudioView from "@/components/claude-studio/ClaudeStudioView";
import { createClient } from "@/lib/supabase/server";
import { getUserOrgs } from "@/lib/supabase/organizations";
import { resolveActiveOrg } from "@/lib/supabase/activeOrg";

async function getPageData(): Promise<{ orgId: string | null; userId: string | null; credits: number }> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (!supabaseUrl.startsWith("http")) return { orgId: null, userId: null, credits: 150 };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { orgId: null, userId: null, credits: 150 };

  const orgs = await getUserOrgs(supabase, user.id);
  const org = await resolveActiveOrg(orgs);

  const { data: profile } = await supabase
    .from("profiles")
    .select("credits")
    .eq("id", user.id)
    .single();

  return {
    orgId: org?.id ?? null,
    userId: user.id,
    credits: profile?.credits ?? 150,
  };
}

export default async function ClaudeStudioPage() {
  const { orgId, userId, credits } = await getPageData();
  return <ClaudeStudioView orgId={orgId} userId={userId} initialCredits={credits} />;
}
