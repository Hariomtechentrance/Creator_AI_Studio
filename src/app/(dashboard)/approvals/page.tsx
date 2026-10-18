import ApprovalsView from "@/components/approvals/ApprovalsView";
import { createClient } from "@/lib/supabase/server";
import { getUserOrgs } from "@/lib/supabase/organizations";
import { resolveActiveOrg } from "@/lib/supabase/activeOrg";
import { getPendingApprovalPosts } from "@/lib/supabase/content";
import type { ContentPost } from "@/types/database";

async function getPageData(): Promise<{ posts: ContentPost[] }> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (!supabaseUrl.startsWith("http")) return { posts: [] };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { posts: [] };

  const orgs = await getUserOrgs(supabase, user.id);
  const org = await resolveActiveOrg(orgs);
  if (!org) return { posts: [] };

  const posts = await getPendingApprovalPosts(supabase, org.id);
  return { posts };
}

export default async function ApprovalsPage() {
  const { posts } = await getPageData();
  return <ApprovalsView initialPosts={posts} />;
}
