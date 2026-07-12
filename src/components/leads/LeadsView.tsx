"use client";

import { useRef, useState } from "react";
import Header from "@/components/layout/Header";
import * as Select from "@radix-ui/react-select";
import {
  Users, Plus, Search, Upload, Star, Phone, Mail, Building2, ChevronDown, Check,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { createLead, updateLeadStatus } from "@/lib/supabase/leads";
import { parseLeadsCsv } from "@/lib/leads/csv";
import { DISPLAY_STATUSES, STATUS_META } from "@/lib/leads/status";
import AddLeadDialog from "@/components/leads/AddLeadDialog";
import LeadDetailDialog from "@/components/leads/LeadDetailDialog";
import type { Lead, LeadStatus } from "@/types/database";
import type { OrgMemberWithProfile } from "@/lib/supabase/organizations";

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 75 ? "#10b981" : score >= 50 ? "#f59e0b" : "#6b7280";
  return (
    <div className="flex items-center gap-1">
      <Star size={10} style={{ color }} />
      <span className="text-xs font-bold" style={{ color }}>{score}</span>
    </div>
  );
}

function StatusSelect({ lead, onChange }: { lead: Lead; onChange: (status: LeadStatus) => void }) {
  const meta = STATUS_META[lead.status] ?? STATUS_META.new;
  return (
    <Select.Root value={lead.status} onValueChange={(v) => onChange(v as LeadStatus)}>
      <Select.Trigger
        onClick={(e) => e.stopPropagation()}
        className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold outline-none"
        style={{ background: meta.bg, color: meta.color }}
      >
        <Select.Value>{meta.label}</Select.Value>
        <ChevronDown size={10} />
      </Select.Trigger>
      <Select.Portal>
        <Select.Content
          className="rounded-xl p-1.5 z-50"
          style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          <Select.Viewport>
            {DISPLAY_STATUSES.map((s) => (
              <Select.Item
                key={s}
                value={s}
                className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm cursor-pointer outline-none transition-colors hover:bg-white/5"
                style={{ color: "var(--text-secondary)" }}
                onClick={(e) => e.stopPropagation()}
              >
                <Select.ItemText>{STATUS_META[s].label}</Select.ItemText>
                <Select.ItemIndicator className="ml-auto"><Check size={13} /></Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}

interface LeadsViewProps {
  orgId: string | null;
  userId: string | null;
  initialLeads: Lead[];
  members: OrgMemberWithProfile[];
}

export default function LeadsView({ orgId, userId, initialLeads, members }: LeadsViewProps) {
  const [leads, setLeads] = useState(initialLeads);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<LeadStatus | "all">("all");
  const [addOpen, setAddOpen] = useState(false);
  const [detailLeadId, setDetailLeadId] = useState<string | null>(null);
  const detailLead = leads.find((l) => l.id === detailLeadId) ?? null;
  const [importing, setImporting] = useState(false);
  const [importSummary, setImportSummary] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filtered = leads.filter((l) => {
    const q = search.toLowerCase();
    const matchSearch = !q || (l.name ?? "").toLowerCase().includes(q) || (l.email ?? "").toLowerCase().includes(q);
    const matchStatus = filterStatus === "all" || l.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const handleStatusChange = async (leadId: string, status: LeadStatus) => {
    const previous = leads;
    setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, status } : l)));

    const supabase = createClient();
    const { error } = await updateLeadStatus(supabase, leadId, status);
    if (error) setLeads(previous);
  };

  const handleImportCsv = async (file: File) => {
    if (!orgId) {
      setImportError("Sign in and create a business first");
      return;
    }
    setImporting(true);
    setImportSummary(null);
    setImportError(null);

    try {
      const text = await file.text();
      const rows = parseLeadsCsv(text);
      const supabase = createClient();
      let imported = 0;
      let skipped = 0;

      for (const row of rows) {
        const name = row.name || row["full name"] || null;
        const email = row.email || null;
        const phone = row.phone || row["phone number"] || null;
        const company = row.company || null;
        if (!email && !phone) { skipped++; continue; }

        const { lead, duplicate } = await createLead(supabase, orgId, { name, email, phone, company, source: "csv" });
        if (duplicate || !lead) {
          skipped++;
        } else {
          imported++;
          setLeads((prev) => [lead, ...prev]);
        }
      }

      setImportSummary(`${imported} imported, ${skipped} skipped as duplicates or missing contact info`);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Couldn't read that CSV file");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div>
      <Header title="Leads" />

      <div className="p-6 space-y-5 max-w-7xl mx-auto">

        {/* Top bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex-1 relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
            <input
              className="input w-full pl-9 text-sm"
              placeholder="Search leads by name, email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImportCsv(f); }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors"
              style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
            >
              {importing ? <span className="spinner w-3 h-3" /> : <Upload size={13} />} Import CSV
            </button>
            <button
              onClick={() => setAddOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold text-white"
              style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)" }}
            >
              <Plus size={13} /> Add Lead
            </button>
          </div>
        </div>

        {importSummary && (
          <p className="text-sm rounded-lg px-3 py-2" style={{ background: "rgba(16,185,129,0.1)", color: "#34d399", border: "1px solid rgba(16,185,129,0.2)" }}>
            {importSummary}
          </p>
        )}
        {importError && (
          <p className="text-sm rounded-lg px-3 py-2" style={{ background: "rgba(239,68,68,0.1)", color: "#f87171", border: "1px solid rgba(239,68,68,0.2)" }}>
            {importError}
          </p>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {DISPLAY_STATUSES.map((s) => {
            const meta = STATUS_META[s];
            const count = leads.filter((l) => l.status === s).length;
            return (
              <button
                key={s}
                onClick={() => setFilterStatus(filterStatus === s ? "all" : s)}
                className="rounded-xl p-3 text-center transition-all"
                style={{
                  background: filterStatus === s ? meta.bg : "var(--bg-card)",
                  border: filterStatus === s ? `1px solid ${meta.color}40` : "1px solid var(--border)",
                }}
              >
                <p className="text-xl font-black" style={{ color: meta.color }}>{count}</p>
                <p className="text-[10px] font-semibold mt-0.5" style={{ color: "var(--text-muted)" }}>{meta.label}</p>
              </button>
            );
          })}
        </div>

        {/* List */}
        <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)", background: "rgba(255,255,255,0.03)" }}>
                {["Lead", "Contact", "Source", "Status", "AI Score", "Added"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-16">
                    <Users size={32} className="mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
                    <p className="text-sm font-semibold" style={{ color: "var(--text-muted)" }}>No leads yet</p>
                  </td>
                </tr>
              ) : filtered.map((lead) => (
                <tr
                  key={lead.id}
                  onClick={() => setDetailLeadId(lead.id)}
                  className="transition-colors hover:bg-white/[0.02] cursor-pointer"
                  style={{ borderBottom: "1px solid var(--border)" }}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                        style={{ background: "linear-gradient(135deg,#7c3aed,#6366f1)" }}
                      >
                        {(lead.name || lead.email || "?")[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">{lead.name || "Unnamed"}</p>
                        {lead.company && (
                          <p className="text-[11px] flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
                            <Building2 size={9} /> {lead.company}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="space-y-0.5">
                      {lead.email && (
                        <div className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--text-secondary)" }}>
                          <Mail size={10} /> {lead.email}
                        </div>
                      )}
                      {lead.phone && (
                        <div className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--text-muted)" }}>
                          <Phone size={10} /> {lead.phone}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs capitalize" style={{ color: "var(--text-secondary)" }}>
                    {lead.source.replace(/_/g, " ")}
                  </td>
                  <td className="px-4 py-3">
                    <StatusSelect lead={lead} onChange={(status) => handleStatusChange(lead.id, status)} />
                  </td>
                  <td className="px-4 py-3">
                    <ScoreBadge score={lead.ai_score} />
                  </td>
                  <td className="px-4 py-3 text-[11px]" style={{ color: "var(--text-muted)" }}>
                    {new Date(lead.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* AI insights bar */}
        <div
          className="rounded-xl p-3.5 flex items-center gap-3"
          style={{ background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.2)" }}
        >
          <Star size={15} className="text-violet-400 shrink-0" />
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            <strong className="text-white">AI Lead Scoring is active.</strong> Every lead gets a 0–100 score based on available signal. Connect Instagram and Facebook (coming soon) to auto-capture leads from comments and DMs.
          </p>
        </div>

      </div>

      <AddLeadDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        orgId={orgId}
        onCreated={(lead) => setLeads((prev) => [lead, ...prev])}
      />

      <LeadDetailDialog
        key={detailLead?.id ?? "none"}
        lead={detailLead}
        onOpenChange={(open) => { if (!open) setDetailLeadId(null); }}
        orgId={orgId}
        userId={userId}
        members={members}
        onDeleted={(leadId) => {
          setLeads((prev) => prev.filter((l) => l.id !== leadId));
          setDetailLeadId(null);
        }}
        onUpdated={(updated) => {
          setLeads((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
        }}
      />
    </div>
  );
}
