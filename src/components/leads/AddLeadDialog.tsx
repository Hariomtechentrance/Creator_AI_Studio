"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as Select from "@radix-ui/react-select";
import { Check, ChevronDown, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { createLead } from "@/lib/supabase/leads";
import type { Lead, LeadSource } from "@/types/database";

const SOURCE_OPTIONS: { value: LeadSource; label: string }[] = [
  { value: "manual", label: "Manual Entry" },
  { value: "website", label: "Website" },
  { value: "referral", label: "Referral" },
  { value: "qr", label: "QR Code" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "instagram_dm", label: "Instagram DM" },
  { value: "instagram_comment", label: "Instagram Comment" },
  { value: "facebook", label: "Facebook" },
  { value: "linkedin", label: "LinkedIn" },
];

interface AddLeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string | null;
  onCreated: (lead: Lead) => void;
}

export default function AddLeadDialog({ open, onOpenChange, orgId, onCreated }: AddLeadDialogProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [source, setSource] = useState<LeadSource>("manual");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const reset = () => {
    setName("");
    setEmail("");
    setPhone("");
    setCompany("");
    setSource("manual");
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId) {
      setError("Sign in and create a business first");
      return;
    }
    setSaving(true);
    setError("");

    try {
      const supabase = createClient();
      const { lead, error: createError } = await createLead(supabase, orgId, {
        name: name.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        company: company.trim() || null,
        source,
      });

      if (createError || !lead) {
        setError(createError ?? "Couldn't create that lead");
        return;
      }

      onCreated(lead);
      reset();
      onOpenChange(false);

      // Fire-and-forget — a failed notification shouldn't undo the lead creation.
      fetch("/api/notifications/lead-created", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: lead.id, orgId, leadName: lead.name || lead.email }),
      }).catch(() => {});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't reach the server");
    } finally {
      setSaving(false);
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
            <Dialog.Title className="text-lg font-bold text-white">Add Lead</Dialog.Title>
            <Dialog.Close className="p-1 rounded-lg hover:bg-white/10">
              <X size={16} style={{ color: "var(--text-muted)" }} />
            </Dialog.Close>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <input className="input w-full" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
            <input className="input w-full" placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <input className="input w-full" placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <input className="input w-full" placeholder="Company (optional)" value={company} onChange={(e) => setCompany(e.target.value)} />

            <Select.Root value={source} onValueChange={(v) => setSource(v as LeadSource)}>
              <Select.Trigger
                className="flex items-center justify-between gap-2 w-full px-3 py-2.5 rounded-lg text-sm"
                style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
              >
                <Select.Value />
                <ChevronDown size={13} />
              </Select.Trigger>
              <Select.Portal>
                <Select.Content
                  className="rounded-xl p-1.5 z-[60]"
                  style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}
                >
                  <Select.Viewport>
                    {SOURCE_OPTIONS.map((opt) => (
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

            {error && (
              <p className="text-sm rounded-lg px-3 py-2" style={{ background: "rgba(239,68,68,0.1)", color: "#f87171", border: "1px solid rgba(239,68,68,0.2)" }}>
                {error}
              </p>
            )}

            <button type="submit" disabled={saving} className="btn-primary w-full justify-center py-2.5">
              {saving ? <span className="spinner" /> : "Add Lead"}
            </button>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
