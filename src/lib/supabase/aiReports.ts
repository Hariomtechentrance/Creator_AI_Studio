import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, AIReport } from "@/types/database";

export async function getLatestReport(
  supabase: SupabaseClient<Database>,
  orgId: string,
): Promise<AIReport | null> {
  const { data } = await supabase
    .from("ai_reports")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data;
}
