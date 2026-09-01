import { getAnthropicClient } from "@/lib/ai/anthropic";
import type { BrandProfile } from "@/types/database";

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    script: { type: "string" },
  },
  required: ["script"],
  additionalProperties: false,
};

const SYSTEM_PROMPT = `You write short spokesperson-video scripts for an Indian SMB's AI avatar to read on camera.

Structure the script around a proven high-retention hook formula, as plain spoken lines (no stage directions, no timestamps, no camera cues — just the words the avatar will say):
- Hook (first ~3s): call out the viewer's specific pain point as a direct question or statement.
- Agitation (~4-10s): briefly make the pain point feel real/costly.
- Solution (~11-22s): introduce the product/idea as the fix.
- Call to action (~23-30s): a short, direct next step.

Rules:
- Total script should read aloud in 15-30 seconds (roughly 40-90 words).
- Conversational spoken tone, not written/marketing-copy tone.
- Never invent pricing, guarantees, stats, or client testimonials that weren't given.
- If brand banned_words are given, never use them. If approved_keywords are given, prefer working them in naturally.`;

export async function expandIdeaToScript(input: {
  idea: string;
  brandProfile: BrandProfile | null;
}): Promise<string> {
  const { idea, brandProfile } = input;

  const userContent = JSON.stringify(
    {
      idea,
      brand: brandProfile
        ? {
            business_type: brandProfile.business_type,
            target_audience: brandProfile.target_audience,
            unique_selling_points: brandProfile.unique_selling_points,
            approved_keywords: brandProfile.approved_keywords,
            banned_words: brandProfile.banned_words,
          }
        : null,
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
    throw new Error("Claude returned no script");
  }

  const parsed = JSON.parse(textBlock.text) as { script: string };
  return parsed.script;
}
