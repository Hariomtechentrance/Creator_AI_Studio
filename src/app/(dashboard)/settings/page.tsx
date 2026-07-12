import Header from "@/components/layout/Header";
import TeamSection from "@/components/settings/TeamSection";
import WhiteLabelSection from "@/components/settings/WhiteLabelSection";
import { createClient } from "@/lib/supabase/server";
import { getUserOrgs, getOrgMembersWithProfiles } from "@/lib/supabase/organizations";
import type { OrgMemberWithProfile } from "@/lib/supabase/organizations";
import { resolveActiveOrg } from "@/lib/supabase/activeOrg";
import type { Organization } from "@/types/database";

async function getTeamData(): Promise<{ org: Organization; canManage: boolean; members: OrgMemberWithProfile[] } | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (!supabaseUrl.startsWith("http")) return null;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const orgs = await getUserOrgs(supabase, user.id);
  const org = await resolveActiveOrg(orgs);
  if (!org) return null;

  const members = await getOrgMembersWithProfiles(supabase, org.id);
  const canManage = members.some((m) => m.user_id === user.id && (m.role === "owner" || m.role === "admin"));

  return { org, canManage, members };
}

export default async function SettingsPage() {
  const team = await getTeamData();

  return (
    <div>
      <Header title="Settings" />
      <div className="p-6 max-w-2xl mx-auto space-y-6">
        {[
          { label: "Profile", fields: [{ l: "Full Name", p: "John Doe", t: "text" }, { l: "Email", p: "john@example.com", t: "email" }] },
          { label: "API Keys", fields: [{ l: "Replicate API Token", p: "r8_••••••••••••••••", t: "password" }, { l: "Runway API Key", p: "key_•••••••••••••••", t: "password" }] },
        ].map(({ label, fields }) => (
          <div key={label} className="card space-y-4">
            <h2 className="font-bold text-white text-lg">{label}</h2>
            {fields.map(({ l, p, t }) => (
              <div key={l}>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--text-secondary)" }}>{l}</label>
                <input type={t} placeholder={p} className="input" />
              </div>
            ))}
            <button className="btn-primary px-5 py-2.5">Save {label}</button>
          </div>
        ))}

        {team && <TeamSection orgId={team.org.id} canManage={team.canManage} members={team.members} />}
        {team && <WhiteLabelSection org={team.org} canManage={team.canManage} />}

        <div className="card space-y-4">
          <h2 className="font-bold text-white text-lg">Danger Zone</h2>
          <button className="btn-secondary border-red-500/30 text-red-400 hover:bg-red-500/10 hover:border-red-500">
            Delete Account
          </button>
        </div>
      </div>
    </div>
  );
}
