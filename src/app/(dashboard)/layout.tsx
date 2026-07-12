import Sidebar from "@/components/layout/Sidebar";
import SessionHydrator from "@/components/layout/SessionHydrator";
import CreateOrgGate from "@/components/onboarding/CreateOrgGate";
import { createClient } from "@/lib/supabase/server";
import { getUserOrgs } from "@/lib/supabase/organizations";
import { resolveActiveOrg } from "@/lib/supabase/activeOrg";
import type { Profile, Organization, OrgMemberRole } from "@/types/database";

interface SessionData {
  profile: Profile | null;
  org: Organization | null;
  orgs: Organization[];
  role: OrgMemberRole | null;
  needsOrg: boolean;
}

async function getSessionData(): Promise<SessionData> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (!supabaseUrl.startsWith("http")) {
    return { profile: null, org: null, orgs: [], role: null, needsOrg: false };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { profile: null, org: null, orgs: [], role: null, needsOrg: false };
  }

  const [{ data: profile }, orgs] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    getUserOrgs(supabase, user.id),
  ]);

  const org = await resolveActiveOrg(orgs);
  let role: OrgMemberRole | null = null;
  if (org) {
    const { data: member } = await supabase
      .from("org_members")
      .select("role")
      .eq("org_id", org.id)
      .eq("user_id", user.id)
      .single();
    role = member?.role ?? null;
  }

  return { profile, org, orgs, role, needsOrg: orgs.length === 0 };
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { profile, org, orgs, role, needsOrg } = await getSessionData();

  if (needsOrg) {
    return <CreateOrgGate />;
  }

  return (
    <div className="flex min-h-screen">
      <SessionHydrator profile={profile} org={org} orgs={orgs} role={role} />
      <Sidebar />
      <main className="flex-1 ml-60 min-h-screen overflow-x-hidden">
        {children}
      </main>
    </div>
  );
}
