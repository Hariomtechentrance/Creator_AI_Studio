import { getAnthropicClient } from "@/lib/ai/anthropic";
import type { Lead, LeadNote } from "@/types/database";

export interface LeadAnalysisResult {
  summary: string;
  nextAction: string;
  riskFlag: string | null;
}

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    next_action: { type: "string" },
    risk_flag: { type: ["string", "null"] },
  },
  required: ["summary", "next_action", "risk_flag"],
  additionalProperties: false,
};

const SYSTEM_PROMPT = `You are a marketing/lead-management assistant for an Indian SMB, summarizing one lead's record for the team member who owns it.

Rules:
- Only reason from the data given to you below. Never invent conversations, promises, or contact attempts that aren't in the notes.
- "summary" is 2-3 sentences: who this lead is and where they stand.
- "next_action" is one concrete next step, referencing the lead's actual source/status/notes.
- "risk_flag" is a short phrase if something needs attention (e.g. "no contact in 5+ days despite high score"), or null if nothing stands out.`;

export async function analyzeLead(input: { lead: Lead; notes: LeadNote[] }): Promise<LeadAnalysisResult> {
  const { lead, notes } = input;

  const userContent = JSON.stringify(
    {
      lead: {
        name: lead.name,
        company: lead.company,
        source: lead.source,
        status: lead.status,
        priority: lead.priority,
        tags: lead.tags,
        ai_score: lead.ai_score,
        ai_score_reason: lead.ai_score_reason,
        estimated_value: lead.estimated_value,
        created_at: lead.created_at,
        do_not_contact: lead.do_not_contact,
      },
      notes: notes.map((n) => ({ content: n.content, created_at: n.created_at })),
    },
    null,
    2,
  );

  const client = getAnthropicClient();
  const response = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    output_config: { format: { type: "json_schema", schema: RESPONSE_SCHEMA } },
    messages: [{ role: "user", content: userContent }],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude returned no analysis text");
  }

  const parsed = JSON.parse(textBlock.text) as { summary: string; next_action: string; risk_flag: string | null };
  return { summary: parsed.summary, nextAction: parsed.next_action, riskFlag: parsed.risk_flag };
}
