import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getBrandProfile } from "@/lib/supabase/brand";
import { getMessages, addMessage } from "@/lib/supabase/conversations";
import { respondToMessage } from "@/lib/ai/chatbot";
import { isAnthropicConfigured } from "@/lib/ai/anthropic";

function isSupabaseConfigured(): boolean {
  return (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").startsWith("http");
}

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return Response.json({ error: "Sign in to try the chatbot" }, { status: 400 });
  }
  if (!isAnthropicConfigured()) {
    return Response.json({ error: "The chatbot isn't configured yet — add GROQ_API_KEY" }, { status: 400 });
  }

  let body: { orgId?: string; conversationId?: string; message?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { orgId, conversationId, message } = body;
  if (!orgId || !conversationId || !message?.trim()) {
    return Response.json({ error: "orgId, conversationId, and message are required" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Sign in required" }, { status: 401 });
  }

  const { data: membership } = await supabase
    .from("org_members")
    .select("id")
    .eq("org_id", orgId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) {
    return Response.json({ error: "Not a member of this organization" }, { status: 403 });
  }

  const [brandProfile, history] = await Promise.all([
    getBrandProfile(supabase, orgId),
    getMessages(supabase, conversationId),
  ]);

  await addMessage(supabase, conversationId, orgId, { senderType: "lead", content: message.trim() });

  try {
    const result = await respondToMessage({ brandProfile, history, newMessage: message.trim() });

    const reply = await addMessage(supabase, conversationId, orgId, {
      senderType: "bot",
      content: result.reply,
      aiGenerated: true,
    });

    await supabase
      .from("conversations")
      .update({
        ai_last_replied_at: new Date().toISOString(),
        status: result.shouldEscalate ? "needs_human" : "bot_handling",
        escalation_reason: result.escalationReason,
      })
      .eq("id", conversationId);

    return Response.json({ reply: reply.content, shouldEscalate: result.shouldEscalate });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Chatbot reply failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
