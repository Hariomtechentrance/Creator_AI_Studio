"use client";

import { useState } from "react";
import Header from "@/components/layout/Header";
import * as Select from "@radix-ui/react-select";
import { CheckCircle2, Circle, ChevronDown, Check, Plus, Target, Users2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { createTask, updateTaskStatus } from "@/lib/supabase/tasks";
import type { Task, Lead } from "@/types/database";
import type { OrgMemberWithProfile } from "@/lib/supabase/organizations";

interface TasksViewProps {
  orgId: string | null;
  userId: string | null;
  initialTasks: Task[];
  leads: Lead[];
  members: OrgMemberWithProfile[];
}

const PRIORITY_COLOR: Record<string, string> = {
  low: "#6b7280",
  medium: "#f59e0b",
  high: "#f97316",
  urgent: "#ef4444",
};

export default function TasksView({ orgId, userId, initialTasks, leads, members }: TasksViewProps) {
  const [tasks, setTasks] = useState(initialTasks);
  const [filter, setFilter] = useState<"open" | "done" | "all">("open");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);

  const leadById = new Map(leads.map((l) => [l.id, l]));

  const filtered = tasks.filter((t) => {
    const matchStatus = filter === "all" ? true : filter === "done" ? t.status === "done" : t.status !== "done";
    const matchAssignee = assigneeFilter === "all" || t.assigned_to === assigneeFilter;
    return matchStatus && matchAssignee;
  });

  const handleToggle = async (task: Task) => {
    const nextStatus = task.status === "done" ? "pending" : "done";
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: nextStatus } : t)));
    const supabase = createClient();
    await updateTaskStatus(supabase, task.id, nextStatus);
  };

  const handleCreate = async () => {
    if (!title.trim() || !orgId || !userId) return;
    setCreating(true);
    try {
      const supabase = createClient();
      const { task } = await createTask(supabase, orgId, userId, {
        leadId: null,
        title: title.trim(),
        description: null,
        type: "follow_up",
        priority: "medium",
        assignedTo: userId,
        dueAt: null,
      });
      if (task) {
        setTasks((prev) => [task, ...prev]);
        setTitle("");
      }
    } finally {
      setCreating(false);
    }
  };

  return (
    <div>
      <Header title="Tasks" />
      <div className="p-6 space-y-5 max-w-4xl mx-auto">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex-1 flex gap-2">
            <input
              className="input flex-1"
              placeholder="New task — e.g. Follow up with Priya"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
            />
            <button
              onClick={handleCreate}
              disabled={creating || !title.trim()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold text-white shrink-0"
              style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)" }}
            >
              {creating ? <span className="spinner w-3 h-3" /> : <Plus size={13} />} Add
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(["open", "done", "all"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors"
              style={{
                background: filter === f ? "rgba(124,58,237,0.2)" : "var(--bg-card)",
                border: filter === f ? "1px solid rgba(124,58,237,0.4)" : "1px solid var(--border)",
                color: filter === f ? "#c4b5fd" : "var(--text-secondary)",
              }}
            >
              {f}
            </button>
          ))}

          <Select.Root value={assigneeFilter} onValueChange={setAssigneeFilter}>
            <Select.Trigger
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold outline-none"
              style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
            >
              <Users2 size={12} />
              <Select.Value />
              <ChevronDown size={11} />
            </Select.Trigger>
            <Select.Portal>
              <Select.Content
                className="rounded-xl p-1.5 z-50"
                style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}
              >
                <Select.Viewport>
                  <Select.Item value="all" className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm cursor-pointer outline-none hover:bg-white/5" style={{ color: "var(--text-secondary)" }}>
                    <Select.ItemText>Everyone</Select.ItemText>
                    <Select.ItemIndicator className="ml-auto"><Check size={13} /></Select.ItemIndicator>
                  </Select.Item>
                  {members.map((m) => (
                    <Select.Item key={m.user_id} value={m.user_id} className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm cursor-pointer outline-none hover:bg-white/5" style={{ color: "var(--text-secondary)" }}>
                      <Select.ItemText>{m.profile?.full_name || m.profile?.email || "Member"}</Select.ItemText>
                      <Select.ItemIndicator className="ml-auto"><Check size={13} /></Select.ItemIndicator>
                    </Select.Item>
                  ))}
                </Select.Viewport>
              </Select.Content>
            </Select.Portal>
          </Select.Root>
        </div>

        <div className="space-y-2">
          {filtered.length === 0 ? (
            <div className="text-center py-16">
              <Target size={32} className="mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
              <p className="text-sm font-semibold" style={{ color: "var(--text-muted)" }}>No tasks here</p>
            </div>
          ) : filtered.map((t) => {
            const lead = t.lead_id ? leadById.get(t.lead_id) : null;
            const assignee = members.find((m) => m.user_id === t.assigned_to);
            return (
              <button
                key={t.id}
                onClick={() => handleToggle(t)}
                className="w-full flex items-center gap-3 rounded-xl p-3.5 text-left transition-colors hover:bg-white/[0.03]"
                style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
              >
                {t.status === "done" ? (
                  <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
                ) : (
                  <Circle size={18} style={{ color: PRIORITY_COLOR[t.priority] ?? "var(--text-muted)" }} className="shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p
                    className="text-sm font-medium truncate"
                    style={{ color: t.status === "done" ? "var(--text-muted)" : "white", textDecoration: t.status === "done" ? "line-through" : "none" }}
                  >
                    {t.title}
                  </p>
                  <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                    {lead ? `Lead: ${lead.name || lead.email || "Unnamed"}` : "No linked lead"}
                    {assignee && ` · ${assignee.profile?.full_name || assignee.profile?.email}`}
                    {t.due_at && ` · Due ${new Date(t.due_at).toLocaleDateString()}`}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
