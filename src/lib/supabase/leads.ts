import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Lead, LeadNote, LeadSource, LeadStatus } from "@/types/database";
import { scoreLead } from "@/lib/leads/scoring";

export async function getLeads(supabase: SupabaseClient<Database>, orgId: string): Promise<Lead[]> {
  const { data } = await supabase
    .from("leads")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  return data ?? [];
}

export async function findDuplicateLead(
  supabase: SupabaseClient<Database>,
  orgId: string,
  email: string | null,
  phone: string | null,
): Promise<Lead | null> {
  if (!email && !phone) return null;

  let query = supabase.from("leads").select("*").eq("org_id", orgId);
  if (email && phone) {
    query = query.or(`email.eq.${email},phone.eq.${phone}`);
  } else if (email) {
    query = query.eq("email", email);
  } else if (phone) {
    query = query.eq("phone", phone);
  }

  const { data } = await query.limit(1).maybeSingle();
  return data;
}

export interface CreateLeadInput {
  name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  source: LeadSource;
}

export async function createLead(
  supabase: SupabaseClient<Database>,
  orgId: string,
  input: CreateLeadInput,
): Promise<{ lead: Lead | null; duplicate: boolean; error: string | null }> {
  const duplicate = await findDuplicateLead(supabase, orgId, input.email, input.phone);
  if (duplicate) {
    return { lead: null, duplicate: true, error: "A lead with this email or phone already exists" };
  }

  const { score, reason } = scoreLead(input);

  const { data, error } = await supabase
    .from("leads")
    .insert({
      org_id: orgId,
      name: input.name,
      email: input.email,
      phone: input.phone,
      location: null,
      company: input.company,
      source: input.source,
      source_post_id: null,
      source_campaign_id: null,
      source_url: null,
      utm_data: {},
      status: "new",
      pipeline_stage_entered_at: {},
      ai_score: score,
      ai_score_reason: reason,
      ai_insights: {},
      ai_last_analyzed_at: new Date().toISOString(),
      assigned_to: null,
      assigned_at: null,
      tags: [],
      priority: "medium",
      preferred_channel: null,
      do_not_contact: false,
      best_contact_time: null,
      estimated_value: 0,
      converted_value: null,
      converted_at: null,
      lost_reason: null,
      custom_fields: {},
    })
    .select("*")
    .single();

  return { lead: data, duplicate: false, error: error?.message ?? null };
}

export async function updateLeadStatus(
  supabase: SupabaseClient<Database>,
  leadId: string,
  status: LeadStatus,
): Promise<{ error: string | null }> {
  const extra: Record<string, unknown> = {};
  if (status === "converted") extra.converted_at = new Date().toISOString();

  const { error } = await supabase.from("leads").update({ status, ...extra }).eq("id", leadId);
  return { error: error?.message ?? null };
}

export async function deleteLead(supabase: SupabaseClient<Database>, leadId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from("leads").delete().eq("id", leadId);
  return { error: error?.message ?? null };
}

export async function updateLeadTags(
  supabase: SupabaseClient<Database>,
  leadId: string,
  tags: string[],
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("leads").update({ tags }).eq("id", leadId);
  return { error: error?.message ?? null };
}

export async function assignLead(
  supabase: SupabaseClient<Database>,
  leadId: string,
  assignedTo: string | null,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("leads")
    .update({ assigned_to: assignedTo, assigned_at: assignedTo ? new Date().toISOString() : null })
    .eq("id", leadId);
  return { error: error?.message ?? null };
}

export async function getLeadNotes(supabase: SupabaseClient<Database>, leadId: string): Promise<LeadNote[]> {
  const { data } = await supabase
    .from("lead_notes")
    .select("*")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false });

  return data ?? [];
}

export async function addLeadNote(
  supabase: SupabaseClient<Database>,
  leadId: string,
  orgId: string,
  content: string,
  createdBy: string,
): Promise<{ note: LeadNote | null; error: string | null }> {
  const { data, error } = await supabase
    .from("lead_notes")
    .insert({ lead_id: leadId, org_id: orgId, content, created_by: createdBy })
    .select("*")
    .single();

  return { note: data, error: error?.message ?? null };
}
