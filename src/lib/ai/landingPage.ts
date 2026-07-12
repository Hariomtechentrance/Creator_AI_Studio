import { getAnthropicClient } from "@/lib/ai/anthropic";
import type { BrandProfile } from "@/types/database";

export interface LandingPageSection {
  heading: string;
  body: string;
}

export interface GeneratedLandingPage {
  title: string;
  headline: string;
  subheadline: string;
  sections: LandingPageSection[];
  ctaText: string;
}

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    headline: { type: "string" },
    subheadline: { type: "string" },
    sections: {
      type: "array",
      items: {
        type: "object",
        properties: { heading: { type: "string" }, body: { type: "string" } },
        required: ["heading", "body"],
        additionalProperties: false,
      },
    },
    cta_text: { type: "string" },
  },
  required: ["title", "headline", "subheadline", "sections", "cta_text"],
  additionalProperties: false,
};

const SYSTEM_PROMPT = `You are a conversion copywriter building a single-page landing page for an Indian SMB.

Rules:
- "title" is an internal short name for this page (not shown to visitors).
- "headline" is a punchy hero headline (under 12 words). "subheadline" supports it in one sentence.
- Write 3-4 "sections" (e.g. benefits, how it works, social proof, FAQ) — each with a heading and 2-3 sentence body.
- "cta_text" is a short button label (e.g. "Get a free quote", "Book a demo") matching the business's actual offering.
- Only use facts given below — never invent pricing, guarantees, or client names that weren't provided.
- Never use any word listed in "banned_words".`;

export async function generateLandingPage(input: {
  topic: string;
  brandProfile: BrandProfile | null;
  orgName: string;
}): Promise<GeneratedLandingPage> {
  const { topic, brandProfile, orgName } = input;

  const userContent = JSON.stringify(
    {
      business_name: orgName,
      topic,
      brand: brandProfile
        ? {
            business_type: brandProfile.business_type,
            offerings: brandProfile.offerings,
            unique_selling_points: brandProfile.unique_selling_points,
            pain_points_solved: brandProfile.pain_points_solved,
            tone_of_voice: brandProfile.tone_of_voice,
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
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    output_config: { format: { type: "json_schema", schema: RESPONSE_SCHEMA } },
    messages: [{ role: "user", content: userContent }],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude returned no page content");
  }

  const parsed = JSON.parse(textBlock.text) as {
    title: string;
    headline: string;
    subheadline: string;
    sections: LandingPageSection[];
    cta_text: string;
  };

  return {
    title: parsed.title,
    headline: parsed.headline,
    subheadline: parsed.subheadline,
    sections: parsed.sections,
    ctaText: parsed.cta_text,
  };
}
