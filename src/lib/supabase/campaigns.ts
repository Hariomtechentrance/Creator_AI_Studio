import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Campaign } from "@/types/database";
import type { AdCopyResult } from "@/lib/ai/adCopy";

export async function getCampaigns(supabase: SupabaseClient<Database>, orgId: string): Promise<Campaign[]> {
  const { data } = await supabase.from("campaigns").select("*").eq("org_id", orgId).order("created_at", { ascending: false });
  return data ?? [];
}

export async function createCampaignFromAdCopy(
  supabase: SupabaseClient<Database>,
  orgId: string,
  createdBy: string,
  input: { name: string; platform: string; goal: string; adCopy: AdCopyResult },
): Promise<{ campaign: Campaign | null; error: string | null }> {
  const { data, error } = await supabase
    .from("campaigns")
    .insert({
      org_id: orgId,
      name: input.name,
      type: "ads",
      goal: input.goal as Campaign["goal"],
      platforms: [input.platform],
      budget: 0,
      ai_strategy: `${input.adCopy.primaryText}\n\nCTA: ${input.adCopy.cta}\n\nAudience: ${input.adCopy.audienceSuggestion}\n\nBudget: ${input.adCopy.budgetSuggestion}`,
      start_date: null,
      end_date: null,
      created_by: createdBy,
    })
    .select("*")
    .single();

  return { campaign: data, error: error?.message ?? null };
}

export async function updateCampaignStatus(
  supabase: SupabaseClient<Database>,
  campaignId: string,
  status: Campaign["status"],
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("campaigns").update({ status }).eq("id", campaignId);
  return { error: error?.message ?? null };
}

export async function deleteCampaign(supabase: SupabaseClient<Database>, campaignId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from("campaigns").delete().eq("id", campaignId);
  return { error: error?.message ?? null };
}
