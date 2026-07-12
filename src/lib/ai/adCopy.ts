import { getAnthropicClient } from "@/lib/ai/anthropic";
import type { BrandProfile } from "@/types/database";

export interface AdCopyResult {
  headlines: string[];
  primaryText: string;
  cta: string;
  audienceSuggestion: string;
  budgetSuggestion: string;
}

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    headlines: { type: "array", items: { type: "string" } },
    primary_text: { type: "string" },
    cta: { type: "string" },
    audience_suggestion: { type: "string" },
    budget_suggestion: { type: "string" },
  },
  required: ["headlines", "primary_text", "cta", "audience_suggestion", "budget_suggestion"],
  additionalProperties: false,
};

const SYSTEM_PROMPT = `You are a performance-marketing copywriter for an Indian SMB, drafting an ad for the platform and goal given below.

Rules:
- "headlines" is 3 short variants (under 40 characters each, platform ad-headline style).
- "primary_text" is the main ad body (2-3 sentences, persuasive, matches the goal).
- "cta" is a short action button label (e.g. "Shop Now", "Get Quote", "Learn More").
- "audience_suggestion" is one paragraph of targeting advice (age/interests/location) based on the brand's actual target audience if given — say so plainly if none was given rather than inventing demographics.
- "budget_suggestion" is one sentence of practical daily-budget guidance for this goal and platform — a reasonable range, not a fabricated precise figure, and note this is a starting-point estimate, not based on live ad account data (none is connected).
- Never invent pricing, guarantees, or client testimonials that weren't provided.`;

export async function generateAdCopy(input: {
  platform: string;
  goal: string;
  productDescription: string;
  brandProfile: BrandProfile | null;
}): Promise<AdCopyResult> {
  const { platform, goal, productDescription, brandProfile } = input;

  const userContent = JSON.stringify(
    {
      platform,
      goal,
      product_description: productDescription,
      brand: brandProfile
        ? {
            business_type: brandProfile.business_type,
            target_audience: brandProfile.target_audience,
            unique_selling_points: brandProfile.unique_selling_points,
            monthly_budget_range: brandProfile.monthly_budget_range,
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
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    output_config: { format: { type: "json_schema", schema: RESPONSE_SCHEMA } },
    messages: [{ role: "user", content: userContent }],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude returned no ad copy");
  }

  const parsed = JSON.parse(textBlock.text) as {
    headlines: string[];
    primary_text: string;
    cta: string;
    audience_suggestion: string;
    budget_suggestion: string;
  };

  return {
    headlines: parsed.headlines,
    primaryText: parsed.primary_text,
    cta: parsed.cta,
    audienceSuggestion: parsed.audience_suggestion,
    budgetSuggestion: parsed.budget_suggestion,
  };
}
