import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Automation, AutomationLog } from "@/types/database";
import type { AutomationAction, AutomationTriggerType } from "@/lib/automations/engine";

export async function getAutomations(supabase: SupabaseClient<Database>, orgId: string): Promise<Automation[]> {
  const { data } = await supabase.from("automations").select("*").eq("org_id", orgId).order("created_at", { ascending: false });
  return data ?? [];
}

export async function getRecentAutomationLogs(supabase: SupabaseClient<Database>, orgId: string): Promise<AutomationLog[]> {
  const { data } = await supabase
    .from("automation_logs")
    .select("*")
    .eq("org_id", orgId)
    .order("executed_at", { ascending: false })
    .limit(20);
  return data ?? [];
}

export async function createAutomation(
  supabase: SupabaseClient<Database>,
  orgId: string,
  createdBy: string,
  input: { name: string; description: string | null; triggerType: AutomationTriggerType; actions: AutomationAction[] },
): Promise<{ automation: Automation | null; error: string | null }> {
  const { data, error } = await supabase
    .from("automations")
    .insert({
      org_id: orgId,
      name: input.name,
      description: input.description,
      trigger_type: input.triggerType,
      trigger_config: {},
      conditions: [],
      actions: input.actions as unknown as Database["public"]["Tables"]["automations"]["Row"]["actions"],
      created_by: createdBy,
    })
    .select("*")
    .single();

  return { automation: data, error: error?.message ?? null };
}

export async function toggleAutomation(
  supabase: SupabaseClient<Database>,
  automationId: string,
  isActive: boolean,
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("automations").update({ is_active: isActive }).eq("id", automationId);
  return { error: error?.message ?? null };
}

export async function deleteAutomation(supabase: SupabaseClient<Database>, automationId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from("automations").delete().eq("id", automationId);
  return { error: error?.message ?? null };
}
