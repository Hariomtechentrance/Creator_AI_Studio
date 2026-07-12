"use client";

import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as Select from "@radix-ui/react-select";
import { X, Mail, Phone, Building2, Star, Trash2, Tag, UserCircle2, ChevronDown, Check, Sparkles, Plus, CalendarClock, CheckCircle2, Circle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getLeadNotes, addLeadNote, deleteLead, updateLeadTags, assignLead } from "@/lib/supabase/leads";
import { getTasksForLead, createTask, updateTaskStatus } from "@/lib/supabase/tasks";
import { STATUS_META } from "@/lib/leads/status";
import type { Lead, LeadNote, Task } from "@/types/database";
import type { OrgMemberWithProfile } from "@/lib/supabase/organizations";

interface LeadDetailDialogProps {
  lead: Lead | null;
  onOpenChange: (open: boolean) => void;
  orgId: string | null;
  userId: string | null;
  members: OrgMemberWithProfile[];
  onDeleted: (leadId: string) => void;
  onUpdated: (lead: Lead) => void;
}

interface AiInsights {
  summary?: string;
  next_action?: string;
  risk_flag?: string | null;
}

export default function LeadDetailDialog({ lead, onOpenChange, orgId, userId, members, onDeleted, onUpdated }: LeadDetailDialogProps) {
  const [notes, setNotes] = useState<LeadNote[]>([]);
  const [newNote, setNewNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [addingTask, setAddingTask] = useState(false);

  const [newTag, setNewTag] = useState("");

  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");

  // Remounted per-lead via `key` in LeadsView, so local state already starts
  // fresh — this effect only needs to fetch.
  useEffect(() => {
    if (!lead) return;
    const supabase = createClient();
    getLeadNotes(supabase, lead.id).then(setNotes);
    getTasksForLead(supabase, lead.id).then(setTasks);
  }, [lead]);

  if (!lead) return null;
  const statusMeta = STATUS_META[lead.status] ?? STATUS_META.new;
  const insights = (lead.ai_insights ?? {}) as AiInsights;
  const assignedMember = members.find((m) => m.user_id === lead.assigned_to);

  const handleAddNote = async () => {
    if (!newNote.trim() || !orgId || !userId) return;
    setSaving(true);
    setError("");

    try {
      const supabase = createClient();
      const { note, error: noteError } = await addLeadNote(supabase, lead.id, orgId, newNote.trim(), userId);
      if (noteError || !note) {
        setError(noteError ?? "Couldn't save that note");
        return;
      }
      setNotes((prev) => [note, ...prev]);
      setNewNote("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't reach the server");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete ${lead.name || lead.email || "this lead"}?`)) return;
    const supabase = createClient();
    await deleteLead(supabase, lead.id);
    onDeleted(lead.id);
  };

  const handleAddTag = async () => {
    const tag = newTag.trim();
    if (!tag || lead.tags.includes(tag)) { setNewTag(""); return; }
    const nextTags = [...lead.tags, tag];
    setNewTag("");
    const supabase = createClient();
    const { error: tagError } = await updateLeadTags(supabase, lead.id, nextTags);
    if (!tagError) onUpdated({ ...lead, tags: nextTags });
  };

  const handleRemoveTag = async (tag: string) => {
    const nextTags = lead.tags.filter((t) => t !== tag);
    const supabase = createClient();
    const { error: tagError } = await updateLeadTags(supabase, lead.id, nextTags);
    if (!tagError) onUpdated({ ...lead, tags: nextTags });
  };

  const handleAssign = async (assignedTo: string) => {
    const resolved = assignedTo === "unassigned" ? null : assignedTo;
    const supabase = createClient();
    const { error: assignError } = await assignLead(supabase, lead.id, resolved);
    if (!assignError) onUpdated({ ...lead, assigned_to: resolved });
  };

  const handleAddTask = async () => {
    if (!newTaskTitle.trim() || !orgId || !userId) return;
    setAddingTask(true);
    try {
      const supabase = createClient();
      const { task } = await createTask(supabase, orgId, userId, {
        leadId: lead.id,
        title: newTaskTitle.trim(),
        description: null,
        type: "follow_up",
        priority: "medium",
        assignedTo: lead.assigned_to,
        dueAt: null,
      });
      if (task) {
        setTasks((prev) => [task, ...prev]);
        setNewTaskTitle("");
      }
    } finally {
      setAddingTask(false);
    }
  };

  const handleToggleTask = async (task: Task) => {
    const nextStatus = task.status === "done" ? "pending" : "done";
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: nextStatus } : t)));
    const supabase = createClient();
    await updateTaskStatus(supabase, task.id, nextStatus);
  };

  const handleGenerateSummary = async () => {
    setAiLoading(true);
    setAiError("");
    try {
      const res = await fetch("/api/ai/analyze-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: lead.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAiError(data.error ?? "Couldn't generate a summary");
        return;
      }
      onUpdated({
        ...lead,
        ai_insights: { summary: data.summary, next_action: data.nextAction, risk_flag: data.riskFlag },
        ai_last_analyzed_at: new Date().toISOString(),
      });
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Couldn't reach the server");
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <Dialog.Root open={!!lead} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50" style={{ background: "rgba(0,0,0,0.6)" }} />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg rounded-2xl p-5 space-y-4 max-h-[85vh] overflow-y-auto"
          style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}
        >
          <div className="flex items-center justify-between">
            <div>
              <Dialog.Title className="text-lg font-bold text-white">{lead.name || "Unnamed lead"}</Dialog.Title>
              {lead.company && (
                <p className="text-xs flex items-center gap-1.5 mt-0.5" style={{ color: "var(--text-muted)" }}>
                  <Building2 size={11} /> {lead.company}
                </p>
              )}
            </div>
            <Dialog.Close className="p-1 rounded-lg hover:bg-white/10">
              <X size={16} style={{ color: "var(--text-muted)" }} />
            </Dialog.Close>
          </div>

          <div className="flex flex-wrap gap-3 text-xs" style={{ color: "var(--text-secondary)" }}>
            {lead.email && <span className="flex items-center gap-1.5"><Mail size={11} /> {lead.email}</span>}
            {lead.phone && <span className="flex items-center gap-1.5"><Phone size={11} /> {lead.phone}</span>}
          </div>

          <div className="flex items-center gap-2 rounded-xl p-3" style={{ background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.2)" }}>
            <Star size={14} style={{ color: "#f59e0b" }} />
            <div className="min-w-0">
              <p className="text-sm font-bold text-white">AI Score: {lead.ai_score}/100</p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>{lead.ai_score_reason}</p>
            </div>
          </div>

          {/* AI lead summary */}
          <div className="rounded-xl p-3 space-y-2" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5" style={{ color: "var(--text-secondary)" }}>
                <Sparkles size={12} className="text-violet-400" /> AI Summary
              </p>
              <button onClick={handleGenerateSummary} disabled={aiLoading} className="btn-secondary px-2.5 py-1 text-[11px]">
                {aiLoading ? <span className="spinner w-3 h-3" /> : insights.summary ? "Regenerate" : "Generate"}
              </button>
            </div>
            {aiError && <p className="text-xs" style={{ color: "#f87171" }}>{aiError}</p>}
            {insights.summary ? (
              <div className="space-y-1.5 text-xs" style={{ color: "var(--text-secondary)" }}>
                <p>{insights.summary}</p>
                {insights.next_action && <p><strong className="text-white">Next:</strong> {insights.next_action}</p>}
                {insights.risk_flag && (
                  <p className="rounded-lg px-2 py-1" style={{ background: "rgba(239,68,68,0.1)", color: "#f87171" }}>⚠ {insights.risk_flag}</p>
                )}
              </div>
            ) : (
              !aiLoading && <p className="text-xs" style={{ color: "var(--text-muted)" }}>No summary yet — generate one from this lead&apos;s notes and score.</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>Status</label>
            <span className="inline-block px-2.5 py-1 rounded-lg text-xs font-bold" style={{ background: statusMeta.bg, color: statusMeta.color }}>
              {statusMeta.label}
            </span>
            <span className="text-xs ml-2" style={{ color: "var(--text-muted)" }}>Change it from the leads table</span>
          </div>

          {/* Assignment */}
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider flex items-center gap-1.5" style={{ color: "var(--text-secondary)" }}>
              <UserCircle2 size={12} /> Assigned to
            </label>
            <Select.Root value={lead.assigned_to ?? "unassigned"} onValueChange={handleAssign}>
              <Select.Trigger
                className="flex items-center justify-between gap-2 w-full px-3 py-2 rounded-lg text-sm"
                style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
              >
                <Select.Value>{assignedMember?.profile?.full_name || assignedMember?.profile?.email || "Unassigned"}</Select.Value>
                <ChevronDown size={13} />
              </Select.Trigger>
              <Select.Portal>
                <Select.Content
                  className="rounded-xl p-1.5 z-[60]"
                  style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}
                >
                  <Select.Viewport>
                    <Select.Item value="unassigned" className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm cursor-pointer outline-none hover:bg-white/5" style={{ color: "var(--text-secondary)" }}>
                      <Select.ItemText>Unassigned</Select.ItemText>
                      <Select.ItemIndicator className="ml-auto"><Check size={13} /></Select.ItemIndicator>
                    </Select.Item>
                    {members.map((m) => (
                      <Select.Item
                        key={m.user_id}
                        value={m.user_id}
                        className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm cursor-pointer outline-none hover:bg-white/5"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        <Select.ItemText>{m.profile?.full_name || m.profile?.email || "Member"}</Select.ItemText>
                        <Select.ItemIndicator className="ml-auto"><Check size={13} /></Select.ItemIndicator>
                      </Select.Item>
                    ))}
                  </Select.Viewport>
                </Select.Content>
              </Select.Portal>
            </Select.Root>
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5" style={{ color: "var(--text-secondary)" }}>
              <Tag size={12} /> Tags
            </label>
            <div className="flex flex-wrap gap-1.5">
              {lead.tags.map((tag) => (
                <span
                  key={tag}
                  className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold"
                  style={{ background: "rgba(124,58,237,0.15)", color: "#c4b5fd" }}
                >
                  {tag}
                  <button onClick={() => handleRemoveTag(tag)} className="hover:text-white"><X size={10} /></button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                className="input flex-1 text-sm"
                placeholder="Add a tag…"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddTag(); } }}
              />
              <button onClick={handleAddTag} disabled={!newTag.trim()} className="btn-secondary px-3"><Plus size={13} /></button>
            </div>
          </div>

          {/* Tasks */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5" style={{ color: "var(--text-secondary)" }}>
              <CalendarClock size={12} /> Tasks & Reminders
            </label>
            <div className="flex gap-2">
              <input
                className="input flex-1"
                placeholder="e.g. Call back tomorrow…"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleAddTask(); }}
              />
              <button onClick={handleAddTask} disabled={addingTask || !newTaskTitle.trim()} className="btn-secondary px-3">
                {addingTask ? <span className="spinner w-4 h-4" /> : "Add"}
              </button>
            </div>
            <div className="space-y-1.5 max-h-32 overflow-y-auto">
              {tasks.map((t) => (
                <button
                  key={t.id}
                  onClick={() => handleToggleTask(t)}
                  className="w-full flex items-center gap-2 rounded-lg p-2 text-left text-sm transition-colors hover:bg-white/5"
                  style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
                >
                  {t.status === "done" ? <CheckCircle2 size={14} className="text-emerald-400 shrink-0" /> : <Circle size={14} style={{ color: "var(--text-muted)" }} className="shrink-0" />}
                  <span style={{ color: t.status === "done" ? "var(--text-muted)" : "var(--text-secondary)", textDecoration: t.status === "done" ? "line-through" : "none" }}>
                    {t.title}
                  </span>
                </button>
              ))}
              {tasks.length === 0 && <p className="text-xs" style={{ color: "var(--text-muted)" }}>No tasks yet.</p>}
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>Notes</label>
            <div className="flex gap-2">
              <input
                className="input flex-1"
                placeholder="Add a note…"
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleAddNote(); }}
              />
              <button onClick={handleAddNote} disabled={saving || !newNote.trim()} className="btn-secondary px-3">
                {saving ? <span className="spinner w-4 h-4" /> : "Add"}
              </button>
            </div>
            {error && <p className="text-xs" style={{ color: "#f87171" }}>{error}</p>}
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {notes.map((n) => (
                <div key={n.id} className="rounded-lg p-2.5 text-sm" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
                  <p style={{ color: "var(--text-secondary)" }}>{n.content}</p>
                  <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>{new Date(n.created_at).toLocaleString()}</p>
                </div>
              ))}
              {notes.length === 0 && <p className="text-xs" style={{ color: "var(--text-muted)" }}>No notes yet.</p>}
            </div>
          </div>

          <button
            onClick={handleDelete}
            className="flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-lg transition-colors"
            style={{ color: "#f87171" }}
          >
            <Trash2 size={13} /> Delete lead
          </button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
