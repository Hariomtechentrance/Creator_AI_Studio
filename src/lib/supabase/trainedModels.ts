import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, TrainedModel } from "@/types/database";

export async function getTrainedModels(supabase: SupabaseClient<Database>, userId: string): Promise<TrainedModel[]> {
  const { data } = await supabase.from("trained_models").select("*").eq("user_id", userId).order("created_at", { ascending: false });
  return data ?? [];
}
