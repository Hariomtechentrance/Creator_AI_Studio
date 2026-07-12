import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseWhatsAppWebhook, sendWhatsAppMessage } from "@/lib/social/whatsapp";
import { createLead, findDuplicateLead } from "@/lib/supabase/leads";
import { getBrandProfile } from "@/lib/supabase/brand";
import { respondToMessage } from "@/lib/ai/chatbot";
import { notifyOrgMembers } from "@/lib/supabase/notifications-server";
import { runAutomations } from "@/lib/automations/engine";
import { isAnthropicConfigured } from "@/lib/ai/anthropic";

// Webhook verification handshake — Meta calls this once when the webhook
// URL is registered in the Meta App dashboard.
export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get("hub.mode");
  const token = request.nextUrl.searchParams.get("hub.verify_token");
  const challenge = request.nextUrl.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN && challenge) {
    return new Response(challenge, { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

export async function POST(request: NextRequest) {
  const payload = await request.json().catch(() => null);
  const inbound = payload ? parseWhatsAppWebhook(payload) : null;
  if (!inbound) return Response.json({ received: true }); // delivery receipts etc. — nothing to do

  const admin = createAdminClient();
  const { data: account } = await admin
    .from("social_accounts")
    .select("*")
    .eq("platform", "whatsapp")
    .eq("account_id", inbound.phoneNumberId)
    .eq("is_active", true)
    .maybeSingle();

  if (!account || !account.access_token) return Response.json({ received: true });

  const orgId = account.org_id;

  // Find or create the lead this message is from.
  let lead = await findDuplicateLead(admin, orgId, null, inbound.fromNumber);
  let isNewLead = false;
  if (!lead) {
    const { lead: created } = await createLead(admin, orgId, {
      name: inbound.fromName,
      email: null,
      phone: inbound.fromNumber,
      company: null,
      source: "whatsapp",
    });
    lead = created;
    isNewLead = true;
  }
  if (!lead) return Response.json({ received: true });

  // Find or create the conversation thread.
  let { data: conversation } = await admin
    .from("conversations")
    .select("*")
    .eq("org_id", orgId)
    .eq("platform", "whatsapp")
    .eq("external_user_id", inbound.fromNumber)
    .maybeSingle();

  if (!conversation) {
    const { data: created } = await admin
      .from("conversations")
      .insert({
        org_id: orgId,
        lead_id: lead.id,
        social_account_id: account.id,
        platform: "whatsapp",
        external_id: inbound.phoneNumberId,
        external_user_id: inbound.fromNumber,
        external_username: inbound.fromName,
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
    conversation = created;
  }
  if (!conversation) return Response.json({ received: true });

  await admin.from("messages").insert({
    conversation_id: conversation.id,
    org_id: orgId,
    sender_type: "lead",
    sender_id: inbound.fromNumber,
    content: inbound.text,
    ai_confidence: null,
    sentiment: null,
    intent_detected: null,
    external_message_id: inbound.externalMessageId,
    delivered_at: null,
    read_at: null,
  });
  await admin.from("conversations").update({ last_message_at: new Date().toISOString() }).eq("id", conversation.id);

  if (isNewLead) {
    await notifyOrgMembers(orgId, { type: "new_lead", title: `New WhatsApp lead: ${lead.name || lead.phone}`, data: { leadId: lead.id } });
    runAutomations(admin, orgId, "lead_created", lead).catch(() => {});
  }

  // Auto-reply via the same chatbot brain Module 9 uses for the website widget.
  if (isAnthropicConfigured()) {
    try {
      const { data: history } = await admin.from("messages").select("*").eq("conversation_id", conversation.id).order("created_at", { ascending: true });
      const brandProfile = await getBrandProfile(admin, orgId);
      const result = await respondToMessage({ brandProfile, history: history ?? [], newMessage: inbound.text });

      await sendWhatsAppMessage(account.account_id, account.access_token, inbound.fromNumber, result.reply);
      await admin.from("messages").insert({
        conversation_id: conversation.id,
        org_id: orgId,
        sender_type: "bot",
        sender_id: null,
        content: result.reply,
        ai_generated: true,
        ai_confidence: null,
        sentiment: null,
        intent_detected: null,
        external_message_id: null,
        delivered_at: null,
        read_at: null,
      });
      await admin
        .from("conversations")
        .update({
          ai_last_replied_at: new Date().toISOString(),
          status: result.shouldEscalate ? "needs_human" : "bot_handling",
          escalation_reason: result.escalationReason,
        })
        .eq("id", conversation.id);
    } catch {
      // A failed auto-reply shouldn't fail the webhook — the message is
      // already saved; a human can still see and answer it in the Inbox.
    }
  }

  return Response.json({ received: true });
}
