import { getAnthropicClient } from "@/lib/ai/anthropic";
import type { BrandProfile } from "@/types/database";

export interface PlatformContent {
  platform: string;
  caption: string;
  hashtags: string[];
  cta: string;
}

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    variations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          platform: { type: "string" },
          caption: { type: "string" },
          hashtags: { type: "array", items: { type: "string" } },
          cta: { type: "string" },
        },
        required: ["platform", "caption", "hashtags", "cta"],
        additionalProperties: false,
      },
    },
  },
  required: ["variations"],
  additionalProperties: false,
};

const SYSTEM_PROMPT = `You are a social media copywriter for an Indian SMB. Write one content variation per requested platform.

Rules:
- Match the requested tone and content type exactly.
- Instagram/Facebook captions can be longer with more hashtags (8-15); LinkedIn should be more professional with 2-4 hashtags; Twitter/X must fit 280 characters with 1-3 hashtags.
- Use the brand's actual name, industry, and unique selling points when given — never invent facts about the business that weren't provided.
- Never use any word listed in "banned_words". Prefer words from "approved_keywords" where they fit naturally — don't force them in.
- If no brand context is given, write generically but still usably.`;

export async function generateContent(input: {
  topic: string;
  contentType: string;
  tone: string;
  platforms: string[];
  brandProfile: BrandProfile | null;
}): Promise<PlatformContent[]> {
  const { topic, contentType, tone, platforms, brandProfile } = input;

  const userContent = JSON.stringify(
    {
      topic,
      content_type: contentType,
      tone,
      platforms,
      brand: brandProfile
        ? {
            business_type: brandProfile.business_type,
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
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    output_config: { format: { type: "json_schema", schema: RESPONSE_SCHEMA } },
    messages: [{ role: "user", content: userContent }],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude returned no content");
  }

  const parsed = JSON.parse(textBlock.text) as { variations: PlatformContent[] };
  return parsed.variations;
}
