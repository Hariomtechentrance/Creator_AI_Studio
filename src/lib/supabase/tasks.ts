import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Task } from "@/types/database";

export async function getTasksForLead(
  supabase: SupabaseClient<Database>,
  leadId: string,
): Promise<Task[]> {
  const { data } = await supabase
    .from("tasks")
    .select("*")
    .eq("lead_id", leadId)
    .order("due_at", { ascending: true, nullsFirst: false });

  return data ?? [];
}

export async function getTasksForOrg(
  supabase: SupabaseClient<Database>,
  orgId: string,
): Promise<Task[]> {
  const { data } = await supabase
    .from("tasks")
    .select("*")
    .eq("org_id", orgId)
    .order("due_at", { ascending: true, nullsFirst: false });

  return data ?? [];
}

export interface CreateTaskInput {
  leadId: string | null;
  title: string;
  description: string | null;
  type: string;
  priority: Task["priority"];
  assignedTo: string | null;
  dueAt: string | null;
}

export async function createTask(
  supabase: SupabaseClient<Database>,
  orgId: string,
  createdBy: string,
  input: CreateTaskInput,
): Promise<{ task: Task | null; error: string | null }> {
  const { data, error } = await supabase
    .from("tasks")
    .insert({
      org_id: orgId,
      lead_id: input.leadId,
      title: input.title,
      description: input.description,
      type: input.type,
      priority: input.priority,
      assigned_to: input.assignedTo,
      due_at: input.dueAt,
      completed_at: null,
      created_by: createdBy,
    })
    .select("*")
    .single();

  return { task: data, error: error?.message ?? null };
}

export async function updateTaskStatus(
  supabase: SupabaseClient<Database>,
  taskId: string,
  status: Task["status"],
): Promise<{ error: string | null }> {
  const completed_at = status === "done" ? new Date().toISOString() : null;
  const { error } = await supabase.from("tasks").update({ status, completed_at }).eq("id", taskId);
  return { error: error?.message ?? null };
}

export async function deleteTask(supabase: SupabaseClient<Database>, taskId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from("tasks").delete().eq("id", taskId);
  return { error: error?.message ?? null };
}
