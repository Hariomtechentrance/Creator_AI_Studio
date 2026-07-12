import PublishView from "@/components/publish/PublishView";
import { createClient } from "@/lib/supabase/server";
import { getUserOrgs } from "@/lib/supabase/organizations";
import { resolveActiveOrg } from "@/lib/supabase/activeOrg";
import { getContentPosts } from "@/lib/supabase/content";
import type { ContentPost } from "@/types/database";

async function getPageData(): Promise<ContentPost[]> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (!supabaseUrl.startsWith("http")) return [];

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const orgs = await getUserOrgs(supabase, user.id);
  const org = await resolveActiveOrg(orgs);
  if (!org) return [];

  return getContentPosts(supabase, org.id);
}

export default async function PublishPage() {
  const posts = await getPageData();
  return <PublishView initialPosts={posts} />;
}
