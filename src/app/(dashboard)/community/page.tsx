import CommunityView from "@/components/community/CommunityView";
import { createClient } from "@/lib/supabase/server";
import { getUserOrgs } from "@/lib/supabase/organizations";
import { resolveActiveOrg } from "@/lib/supabase/activeOrg";
import { getConversations } from "@/lib/supabase/conversations";
import type { Conversation } from "@/types/database";

async function getPageData(): Promise<{ orgId: string | null; conversations: Conversation[] }> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (!supabaseUrl.startsWith("http")) return { orgId: null, conversations: [] };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { orgId: null, conversations: [] };

  const orgs = await getUserOrgs(supabase, user.id);
  const org = await resolveActiveOrg(orgs);
  if (!org) return { orgId: null, conversations: [] };

  const conversations = await getConversations(supabase, org.id);
  return { orgId: org.id, conversations };
}

export default async function CommunityPage() {
  const { orgId, conversations } = await getPageData();
  return <CommunityView orgId={orgId} initialConversations={conversations} />;
}
