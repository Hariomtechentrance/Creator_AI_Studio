"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Organization } from "@/types/database";

export default function WhiteLabelSection({ org, canManage }: { org: Organization; canManage: boolean }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(org.white_label_enabled);
  const [name, setName] = useState(org.white_label_name ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const isAgency = org.plan_tier === "agency";

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/org/white-label", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId: org.id, enabled, name }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't save");
        return;
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't reach the server");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card space-y-4">
      <h2 className="font-bold text-white text-lg">White Label</h2>
      {!isAgency ? (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Rebranding the app with your own name for clients needs the Agency plan. Custom domains aren&apos;t available yet — they need DNS/hosting infrastructure this workspace doesn&apos;t manage.
        </p>
      ) : !canManage ? (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>Only the owner or an admin can change white-label settings.</p>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setEnabled(!enabled)}
              className="w-9 h-5 rounded-full relative transition-colors shrink-0"
              style={{ background: enabled ? "#7c3aed" : "var(--border)" }}
            >
              <span className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all" style={{ left: enabled ? 18 : 2 }} />
            </button>
            <span className="text-sm" style={{ color: "var(--text-secondary)" }}>Show your own name instead of &ldquo;GrowthPilot&rdquo; in the sidebar</span>
          </div>
          {enabled && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--text-secondary)" }}>Display Name</label>
              <input className="input" placeholder="Your Agency Name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          )}
          {error && <p className="text-sm" style={{ color: "#f87171" }}>{error}</p>}
          <button onClick={handleSave} disabled={saving} className="btn-primary px-5 py-2.5">
            {saving ? <span className="spinner" /> : "Save White Label Settings"}
          </button>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>Custom domains aren&apos;t available yet — needs DNS/hosting infrastructure this workspace doesn&apos;t manage.</p>
        </>
      )}
    </div>
  );
}
