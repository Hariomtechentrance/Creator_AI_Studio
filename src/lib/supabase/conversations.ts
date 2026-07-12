import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Conversation, Message } from "@/types/database";

export async function getConversations(supabase: SupabaseClient<Database>, orgId: string): Promise<Conversation[]> {
  const { data } = await supabase
    .from("conversations")
    .select("*")
    .eq("org_id", orgId)
    .order("last_message_at", { ascending: false });
  return data ?? [];
}

export async function getMessages(supabase: SupabaseClient<Database>, conversationId: string): Promise<Message[]> {
  const { data } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  return data ?? [];
}

export async function getOrCreateWebsiteTestConversation(
  supabase: SupabaseClient<Database>,
  orgId: string,
): Promise<Conversation> {
  const { data: existing } = await supabase
    .from("conversations")
    .select("*")
    .eq("org_id", orgId)
    .eq("platform", "website")
    .eq("external_id", "test-widget")
    .maybeSingle();

  if (existing) return existing;

  const { data, error } = await supabase
    .from("conversations")
    .insert({
      org_id: orgId,
      lead_id: null,
      social_account_id: null,
      platform: "website",
      external_id: "test-widget",
      external_user_id: null,
      external_username: "Test visitor",
      external_avatar: null,
      assigned_to: null,
      post_id: null,
      sentiment: null,
      intent: null,
      ai_last_replied_at: null,
      escalation_reason: null,
    })
    .select("*")
    .single();

  if (error || !data) throw new Error(error?.message ?? "Couldn't start a test conversation");
  return data;
}

/**
 * Average minutes between a lead's message and the next human_agent reply
 * in the same conversation (bot replies don't count — this measures human
 * team response time). Returns null if no human agent has replied to
 * anything yet, rather than a misleading 0.
 */
export async function getAvgResponseTimeMinutes(supabase: SupabaseClient<Database>, orgId: string): Promise<number | null> {
  const { data: messages } = await supabase
    .from("messages")
    .select("conversation_id, sender_type, created_at")
    .eq("org_id", orgId)
    .order("conversation_id", { ascending: true })
    .order("created_at", { ascending: true });

  if (!messages || messages.length === 0) return null;

  const gapsMs: number[] = [];
  let pendingLeadAt: string | null = null;
  let currentConversation: string | null = null;

  for (const m of messages) {
    if (m.conversation_id !== currentConversation) {
      currentConversation = m.conversation_id;
      pendingLeadAt = null;
    }
    if (m.sender_type === "lead") {
      pendingLeadAt = m.created_at;
    } else if (m.sender_type === "human_agent" && pendingLeadAt) {
      gapsMs.push(new Date(m.created_at).getTime() - new Date(pendingLeadAt).getTime());
      pendingLeadAt = null;
    }
  }

  if (gapsMs.length === 0) return null;
  return Math.round(gapsMs.reduce((sum, g) => sum + g, 0) / gapsMs.length / 60000);
}

export async function addMessage(
  supabase: SupabaseClient<Database>,
  conversationId: string,
  orgId: string,
  input: { senderType: Message["sender_type"]; content: string; aiGenerated?: boolean },
): Promise<Message> {
  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      org_id: orgId,
      sender_type: input.senderType,
      sender_id: null,
      content: input.content,
      ai_generated: input.aiGenerated ?? false,
      ai_confidence: null,
      sentiment: null,
      intent_detected: null,
      external_message_id: null,
      delivered_at: null,
      read_at: null,
    })
    .select("*")
    .single();

  if (error || !data) throw new Error(error?.message ?? "Couldn't send that message");

  await supabase.from("conversations").update({ last_message_at: new Date().toISOString() }).eq("id", conversationId);

  return data;
}
