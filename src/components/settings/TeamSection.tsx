"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import * as Select from "@radix-ui/react-select";
import { Check, ChevronDown, UserPlus } from "lucide-react";
import type { OrgMemberRole } from "@/types/database";
import type { OrgMemberWithProfile } from "@/lib/supabase/organizations";

const ROLE_OPTIONS: { value: OrgMemberRole; label: string }[] = [
  { value: "admin", label: "Admin" },
  { value: "manager", label: "Manager" },
  { value: "sales", label: "Sales" },
  { value: "marketing", label: "Marketing" },
  { value: "viewer", label: "Viewer" },
];

interface TeamSectionProps {
  orgId: string;
  canManage: boolean;
  members: OrgMemberWithProfile[];
}

export default function TeamSection({ orgId, canManage, members }: TeamSectionProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<OrgMemberRole>("marketing");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/org/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId, email, role }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't send that invite");
        return;
      }
      setSuccess(`Invited ${email}`);
      setEmail("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't reach the server");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card space-y-4">
      <h2 className="font-bold text-white text-lg">Team</h2>

      <div className="space-y-2">
        {members.map((m) => (
          <div key={m.id} className="flex items-center gap-3 py-2" style={{ borderBottom: "1px solid var(--border)" }}>
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
              style={{ background: "linear-gradient(135deg,#7c3aed,#6366f1)" }}
            >
              {m.profile?.full_name?.[0]?.toUpperCase() ?? m.profile?.email?.[0]?.toUpperCase() ?? "?"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{m.profile?.full_name || m.profile?.email || "Unknown"}</p>
              <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>{m.profile?.email}</p>
            </div>
            <span className="badge badge-purple text-xs capitalize">{m.role}</span>
          </div>
        ))}
        {members.length === 0 && (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>No team members yet.</p>
        )}
      </div>

      {canManage && (
        <form onSubmit={handleInvite} className="flex items-end gap-2 pt-2">
          <div className="flex-1">
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
              Invite by email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teammate@example.com"
              required
              className="input"
            />
          </div>

          <Select.Root value={role} onValueChange={(v) => setRole(v as OrgMemberRole)}>
            <Select.Trigger
              className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm capitalize"
              style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
            >
              <Select.Value />
              <ChevronDown size={13} />
            </Select.Trigger>
            <Select.Portal>
              <Select.Content
                className="rounded-xl p-1.5 z-50"
                style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}
              >
                <Select.Viewport>
                  {ROLE_OPTIONS.map((opt) => (
                    <Select.Item
                      key={opt.value}
                      value={opt.value}
                      className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm cursor-pointer outline-none transition-colors hover:bg-white/5"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      <Select.ItemText>{opt.label}</Select.ItemText>
                      <Select.ItemIndicator className="ml-auto"><Check size={13} /></Select.ItemIndicator>
                    </Select.Item>
                  ))}
                </Select.Viewport>
              </Select.Content>
            </Select.Portal>
          </Select.Root>

          <button type="submit" disabled={loading || !email.trim()} className="btn-primary px-4 py-2.5">
            {loading ? <span className="spinner" /> : <><UserPlus size={14} /> Invite</>}
          </button>
        </form>
      )}

      {error && (
        <p className="text-sm rounded-lg px-3 py-2" style={{ background: "rgba(239,68,68,0.1)", color: "#f87171", border: "1px solid rgba(239,68,68,0.2)" }}>
          {error}
        </p>
      )}
      {success && (
        <p className="text-sm rounded-lg px-3 py-2" style={{ background: "rgba(16,185,129,0.1)", color: "#34d399", border: "1px solid rgba(16,185,129,0.2)" }}>
          {success}
        </p>
      )}
    </div>
  );
}
