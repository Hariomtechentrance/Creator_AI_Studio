import { getAnthropicClient } from "@/lib/ai/anthropic";
import type { BrandProfile, Lead, LeadNote } from "@/types/database";

const SYSTEM_PROMPT = `You are the Sales AI Agent for a small business — helping a human team member work one specific lead: qualifying them, handling objections, proposing meeting times, and drafting follow-ups.

Rules:
- Only reason from the lead's actual data and notes given below. Never invent prior conversations, promises made, or objections that weren't described to you.
- You cannot book a real meeting or send messages yourself — no calendar or messaging platform is connected. When asked to "schedule a meeting," propose 2-3 concrete time-window suggestions the human can offer, and say plainly that they'll need to send/confirm it themselves.
- When asked to "draft a message" or "reply to this objection," write it as a ready-to-send message in the business's tone (from brand profile), addressed to the lead by name if known.
- When asked to qualify the lead, reason from ai_score/ai_score_reason/tags/notes — flag what's still unknown rather than guessing.
- Keep replies focused and practical — this is a working session with a teammate, not a lecture.`;

export async function chatWithSalesAgent(input: {
  lead: Lead;
  notes: LeadNote[];
  brandProfile: BrandProfile | null;
  history: { role: "user" | "assistant"; content: string }[];
  message: string;
}): Promise<string> {
  const { lead, notes, brandProfile, history, message } = input;

  const context = {
    lead: {
      name: lead.name,
      company: lead.company,
      source: lead.source,
      status: lead.status,
      priority: lead.priority,
      tags: lead.tags,
      ai_score: lead.ai_score,
      ai_score_reason: lead.ai_score_reason,
      ai_insights: lead.ai_insights,
      estimated_value: lead.estimated_value,
      preferred_channel: lead.preferred_channel,
      do_not_contact: lead.do_not_contact,
      created_at: lead.created_at,
    },
    notes: notes.map((n) => ({ content: n.content, created_at: n.created_at })),
    brand: brandProfile
      ? {
          business_type: brandProfile.business_type,
          tone_of_voice: brandProfile.tone_of_voice,
          offerings: brandProfile.offerings,
          unique_selling_points: brandProfile.unique_selling_points,
          banned_words: brandProfile.banned_words,
        }
      : null,
  };

  const client = getAnthropicClient();
  const response = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 1024,
    system: `${SYSTEM_PROMPT}\n\nLead context:\n${JSON.stringify(context, null, 2)}`,
    messages: [...history, { role: "user", content: message }],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("The agent returned no reply");
  }
  return textBlock.text;
}
