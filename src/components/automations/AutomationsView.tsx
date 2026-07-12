"use client";

import { useState } from "react";
import Header from "@/components/layout/Header";
import { Zap, Plus, Trash2, MessageCircle, Mail, Phone, ListChecks, Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { createAutomation, toggleAutomation, deleteAutomation } from "@/lib/supabase/automations";
import type { Automation, AutomationLog } from "@/types/database";
import type { AutomationAction } from "@/lib/automations/engine";

interface AutomationsViewProps {
  orgId: string | null;
  userId: string | null;
  initialAutomations: Automation[];
  logs: AutomationLog[];
}

interface Template {
  name: string;
  description: string;
  triggerType: "lead_created" | "lead_status_changed";
  actions: AutomationAction[];
  icon: React.ReactNode;
}

const TEMPLATES: Template[] = [
  {
    name: "Follow up with new leads",
    description: "When a lead comes in, create a follow-up task due in 24 hours.",
    triggerType: "lead_created",
    actions: [{ type: "create_follow_up_task", delay_hours: 24 }],
    icon: <ListChecks size={16} className="text-violet-400" />,
  },
  {
    name: "Notify the assignee instantly",
    description: "When a lead comes in and is already assigned, notify that teammate right away.",
    triggerType: "lead_created",
    actions: [{ type: "notify_assignee" }],
    icon: <Bell size={16} className="text-amber-400" />,
  },
  {
    name: "WhatsApp auto follow-up",
    description: "When a lead comes in, send a WhatsApp welcome message — needs a WhatsApp number connected in Social Accounts.",
    triggerType: "lead_created",
    actions: [{ type: "send_whatsapp_message", message_template: "Hi {name}, thanks for reaching out! We'll be in touch shortly." }],
    icon: <MessageCircle size={16} className="text-emerald-400" />,
  },
  {
    name: "Email welcome sequence",
    description: "When a lead comes in, send a welcome email — needs RESEND_API_KEY configured.",
    triggerType: "lead_created",
    actions: [{ type: "send_email", email_subject: "Thanks for reaching out", message_template: "Hi {name}, thanks for your interest — we'll be in touch shortly!" }],
    icon: <Mail size={16} className="text-blue-400" />,
  },
  {
    name: "SMS reminder",
    description: "When a lead comes in, send a text reminder — needs Twilio configured.",
    triggerType: "lead_created",
    actions: [{ type: "send_sms", message_template: "Hi {name}, thanks for reaching out! We'll be in touch shortly." }],
    icon: <Phone size={16} className="text-orange-400" />,
  },
];

export default function AutomationsView({ orgId, userId, initialAutomations, logs }: AutomationsViewProps) {
  const [automations, setAutomations] = useState(initialAutomations);
  const [creating, setCreating] = useState<string | null>(null);

  const handleAddTemplate = async (template: Template) => {
    if (!orgId || !userId) return;
    setCreating(template.name);
    try {
      const supabase = createClient();
      const { automation } = await createAutomation(supabase, orgId, userId, {
        name: template.name,
        description: template.description,
        triggerType: template.triggerType,
        actions: template.actions,
      });
      if (automation) setAutomations((prev) => [automation, ...prev]);
    } finally {
      setCreating(null);
    }
  };

  const handleToggle = async (automation: Automation) => {
    setAutomations((prev) => prev.map((a) => (a.id === automation.id ? { ...a, is_active: !a.is_active } : a)));
    const supabase = createClient();
    await toggleAutomation(supabase, automation.id, !automation.is_active);
  };

  const handleDelete = async (id: string) => {
    setAutomations((prev) => prev.filter((a) => a.id !== id));
    const supabase = createClient();
    await deleteAutomation(supabase, id);
  };

  const activeNames = new Set(automations.map((a) => a.name));

  return (
    <div>
      <Header title="Automations" />
      <div className="p-6 space-y-6 max-w-3xl mx-auto">

        <div>
          <h2 className="text-sm font-bold text-white mb-2">Templates</h2>
          <div className="grid gap-2.5">
            {TEMPLATES.map((t) => (
              <div key={t.name} className="flex items-center gap-3 rounded-xl p-3.5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgba(124,58,237,0.15)" }}>{t.icon}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white">{t.name}</p>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>{t.description}</p>
                </div>
                <button
                  onClick={() => handleAddTemplate(t)}
                  disabled={creating === t.name || activeNames.has(t.name)}
                  className="btn-secondary px-3 py-1.5 text-xs shrink-0"
                >
                  {creating === t.name ? <span className="spinner w-3 h-3" /> : activeNames.has(t.name) ? "Added" : <><Plus size={12} className="inline mr-1" />Add</>}
                </button>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-sm font-bold text-white mb-2 flex items-center gap-1.5"><Zap size={14} className="text-violet-400" /> Active automations</h2>
          {automations.length === 0 ? (
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>None yet — add a template above.</p>
          ) : (
            <div className="space-y-2">
              {automations.map((a) => (
                <div key={a.id} className="flex items-center gap-3 rounded-xl p-3" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
                  <button
                    onClick={() => handleToggle(a)}
                    className="w-9 h-5 rounded-full relative transition-colors shrink-0"
                    style={{ background: a.is_active ? "#7c3aed" : "var(--border)" }}
                  >
                    <span className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all" style={{ left: a.is_active ? 18 : 2 }} />
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white">{a.name}</p>
                    <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>Ran {a.run_count} time{a.run_count === 1 ? "" : "s"}{a.last_run_at ? ` · last ${new Date(a.last_run_at).toLocaleDateString()}` : ""}</p>
                  </div>
                  <button onClick={() => handleDelete(a.id)} className="p-1.5 rounded-lg hover:bg-white/10 shrink-0"><Trash2 size={13} style={{ color: "#f87171" }} /></button>
                </div>
              ))}
            </div>
          )}
        </div>

        {logs.length > 0 && (
          <div>
            <h2 className="text-sm font-bold text-white mb-2">Recent activity</h2>
            <div className="space-y-1.5">
              {logs.map((l) => (
                <div key={l.id} className="flex items-center justify-between text-xs rounded-lg px-3 py-2" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
                  <span style={{ color: l.status === "failed" ? "#f87171" : "var(--text-secondary)" }}>
                    {l.status === "failed" ? `Failed: ${l.error}` : `${l.actions_executed.length} action(s) executed`}
                  </span>
                  <span style={{ color: "var(--text-muted)" }}>{new Date(l.executed_at).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
