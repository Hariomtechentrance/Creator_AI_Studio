import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Organization, OrgMember, Profile } from "@/types/database";

export interface OrgMemberWithProfile extends OrgMember {
  profile: Pick<Profile, "full_name" | "email" | "avatar_url"> | null;
}

export async function getUserOrgs(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<Organization[]> {
  const [{ data: owned }, { data: memberRows }] = await Promise.all([
    supabase.from("organizations").select("*").eq("owner_id", userId),
    supabase.from("org_members").select("org_id").eq("user_id", userId),
  ]);

  const memberOrgIds = (memberRows ?? []).map((m) => m.org_id);
  let memberOrgs: Organization[] = [];
  if (memberOrgIds.length > 0) {
    const { data } = await supabase.from("organizations").select("*").in("id", memberOrgIds);
    memberOrgs = data ?? [];
  }

  const byId = new Map<string, Organization>();
  for (const org of [...(owned ?? []), ...memberOrgs]) byId.set(org.id, org);

  return [...byId.values()].sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export async function updateOrgLogo(
  supabase: SupabaseClient<Database>,
  orgId: string,
  logoUrl: string | null,
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("organizations").update({ logo_url: logoUrl }).eq("id", orgId);
  return { error: error?.message ?? null };
}

export async function getOrgMembersWithProfiles(
  supabase: SupabaseClient<Database>,
  orgId: string,
): Promise<OrgMemberWithProfile[]> {
  const { data: members } = await supabase
    .from("org_members")
    .select("*")
    .eq("org_id", orgId)
    .order("joined_at", { ascending: true });

  if (!members || members.length === 0) return [];

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, email, avatar_url")
    .in("id", members.map((m) => m.user_id));

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  return members.map((m) => ({ ...m, profile: profileById.get(m.user_id) ?? null }));
}
