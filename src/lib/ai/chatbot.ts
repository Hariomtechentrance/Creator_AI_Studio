import { getAnthropicClient } from "@/lib/ai/anthropic";
import type { BrandProfile, Message } from "@/types/database";

export interface ChatbotReply {
  reply: string;
  shouldEscalate: boolean;
  escalationReason: string | null;
}

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    reply: { type: "string" },
    should_escalate: { type: "boolean" },
    escalation_reason: { type: ["string", "null"] },
  },
  required: ["reply", "should_escalate", "escalation_reason"],
  additionalProperties: false,
};

const SYSTEM_PROMPT = `You are the website/WhatsApp support chatbot for a small business, answering visitor questions and qualifying leads.

Rules:
- Only answer using the brand context given below. If you don't know something (pricing, availability, order status), say so honestly and offer to connect them with the team — never invent facts about the business.
- Keep replies short and conversational (2-4 sentences), like a real chat, not an essay.
- If the visitor asks something you can't help with, or seems frustrated/angry, or explicitly asks for a human, set should_escalate to true with a one-line reason.
- If the visitor shares contact info or clear buying intent, acknowledge it warmly — a lead record is created separately, you don't need to ask them to fill a form.
- Never use any word listed in "banned_words" in the brand context.`;

export async function respondToMessage(input: {
  brandProfile: BrandProfile | null;
  history: Message[];
  newMessage: string;
}): Promise<ChatbotReply> {
  const { brandProfile, history, newMessage } = input;

  const userContent = JSON.stringify(
    {
      brand: brandProfile
        ? {
            business_type: brandProfile.business_type,
            tone_of_voice: brandProfile.tone_of_voice,
            offerings: brandProfile.offerings,
            unique_selling_points: brandProfile.unique_selling_points,
            pain_points_solved: brandProfile.pain_points_solved,
            banned_words: brandProfile.banned_words,
          }
        : null,
      conversation_history: history.slice(-10).map((m) => ({
        from: m.sender_type,
        content: m.content,
      })),
      new_message: newMessage,
    },
    null,
    2,
  );

  const client = getAnthropicClient();
  const response = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 512,
    system: SYSTEM_PROMPT,
    output_config: { format: { type: "json_schema", schema: RESPONSE_SCHEMA } },
    messages: [{ role: "user", content: userContent }],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude returned no reply");
  }

  const parsed = JSON.parse(textBlock.text) as { reply: string; should_escalate: boolean; escalation_reason: string | null };
  return { reply: parsed.reply, shouldEscalate: parsed.should_escalate, escalationReason: parsed.escalation_reason };
}
