"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as Dialog from "@radix-ui/react-dialog";
import { Check, ChevronsUpDown, PlusCircle, X } from "lucide-react";
import { useSessionStore } from "@/store/useSessionStore";
import { createClient } from "@/lib/supabase/client";

export default function OrgSwitcher() {
  const router = useRouter();
  const org = useSessionStore((s) => s.org);
  const orgs = useSessionStore((s) => s.orgs);
  const [switching, setSwitching] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const handleSwitch = async (orgId: string) => {
    if (orgId === org?.id) return;
    setSwitching(orgId);
    try {
      const res = await fetch("/api/org/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId }),
      });
      if (res.ok) {
        router.refresh();
      }
    } finally {
      setSwitching(null);
    }
  };

  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button className="w-full flex items-center gap-2.5 p-2 rounded-xl cursor-pointer hover:bg-white/5 transition-colors outline-none">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-xs font-bold text-white shrink-0">
              {org?.name?.[0]?.toUpperCase() ?? "G"}
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-xs font-semibold text-white truncate">{org?.name ?? "My Organization"}</p>
              <p className="text-[10px] capitalize" style={{ color: "var(--text-muted)" }}>{org ? `${org.plan_tier} Plan` : "Free Plan"}</p>
            </div>
            <ChevronsUpDown size={12} className="text-gray-600 shrink-0" />
          </button>
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="start"
            side="top"
            sideOffset={8}
            className="min-w-56 rounded-xl p-1.5 z-50"
            style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}
          >
            <DropdownMenu.Label
              className="px-2.5 pt-1.5 pb-1 text-[10px] font-bold uppercase tracking-widest"
              style={{ color: "var(--text-muted)" }}
            >
              Your businesses
            </DropdownMenu.Label>
            {orgs.map((o) => (
              <DropdownMenu.Item
                key={o.id}
                onSelect={() => handleSwitch(o.id)}
                className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm cursor-pointer outline-none transition-colors hover:bg-white/5"
                style={{ color: "var(--text-secondary)" }}
              >
                <div className="w-5 h-5 rounded-md bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                  {o.name[0]?.toUpperCase() ?? "?"}
                </div>
                <span className="flex-1 truncate">{o.name}</span>
                {o.id === org?.id && <Check size={13} className="text-violet-400 shrink-0" />}
                {switching === o.id && <span className="spinner" style={{ width: 12, height: 12 }} />}
              </DropdownMenu.Item>
            ))}
            <DropdownMenu.Separator style={{ height: 1, background: "var(--border)", margin: "4px 0" }} />
            <DropdownMenu.Item
              onSelect={() => setCreateOpen(true)}
              className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm cursor-pointer outline-none transition-colors hover:bg-white/5"
              style={{ color: "#c4b5fd" }}
            >
              <PlusCircle size={14} /> Add another business
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      <CreateBusinessDialog open={createOpen} onOpenChange={setCreateOpen} />
    </>
  );
}

function CreateBusinessDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const supabase = createClient();
      const { data: newOrg, error: rpcError } = await supabase.rpc("create_organization_with_owner", {
        p_name: name.trim(),
      });
      if (rpcError) {
        setError(rpcError.message);
        return;
      }
      if (newOrg?.id) {
        await fetch("/api/org/switch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orgId: newOrg.id }),
        });
      }
      setName("");
      onOpenChange(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't reach the server");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50" style={{ background: "rgba(0,0,0,0.6)" }} />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md rounded-2xl p-5 space-y-4"
          style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}
        >
          <div className="flex items-center justify-between">
            <Dialog.Title className="text-lg font-bold text-white">Add another business</Dialog.Title>
            <Dialog.Close className="p-1 rounded-lg hover:bg-white/10">
              <X size={16} style={{ color: "var(--text-muted)" }} />
            </Dialog.Close>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
                Business name
              </label>
              <input
                className="input w-full"
                placeholder="Acme Marketing Co."
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                minLength={2}
                autoFocus
              />
            </div>

            {error && (
              <p className="text-sm rounded-lg px-3 py-2" style={{ background: "rgba(239,68,68,0.1)", color: "#f87171", border: "1px solid rgba(239,68,68,0.2)" }}>
                {error}
              </p>
            )}

            <button type="submit" disabled={loading || !name.trim()} className="btn-primary w-full justify-center py-2.5">
              {loading ? <span className="spinner" /> : "Create business"}
            </button>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
