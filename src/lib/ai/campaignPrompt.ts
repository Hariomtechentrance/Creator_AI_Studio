import { getAnthropicClient } from "@/lib/ai/anthropic";
import type { BrandProfile } from "@/types/database";

export interface CampaignPlan {
  objective: "awareness" | "leads" | "sales" | "engagement" | "traffic";
  headline: string;
  primaryText: string;
  highlights: string[];
  hashtags: string[];
  ctaLabel: string;
  cityNames: string[];
  ageMin: number;
  ageMax: number;
  genders: "all" | "male" | "female";
  dailyBudgetInr: number;
}

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    objective: { type: "string", enum: ["awareness", "leads", "sales", "engagement", "traffic"] },
    headline: { type: "string" },
    primary_text: { type: "string" },
    highlights: { type: "array", items: { type: "string" } },
    hashtags: { type: "array", items: { type: "string" } },
    cta_label: { type: "string" },
    city_names: { type: "array", items: { type: "string" } },
    age_min: { type: "integer" },
    age_max: { type: "integer" },
    genders: { type: "string", enum: ["all", "male", "female"] },
    daily_budget_inr: { type: "integer" },
  },
  required: ["objective", "headline", "primary_text", "highlights", "hashtags", "cta_label", "city_names", "age_min", "age_max", "genders", "daily_budget_inr"],
  additionalProperties: false,
};

const SYSTEM_PROMPT = `You turn one plain-language campaign request from an Indian SMB owner into a complete, structured Meta Ads campaign plan. Read the request carefully and extract everything it actually says before inventing anything.

Rules:
- "objective": pick the single closest match — awareness (brand/reach), leads (collect enquiries/contact details), sales (drive purchases), engagement (likes/comments/messages), traffic (website visits). Infer from phrases like "get calls", "collect leads", "drive sales", "brand awareness".
- "headline": under 60 characters, a real hook — a pain point or benefit, not just the brand name.
- "primary_text": 3-5 sentences of real ad body copy matching the objective and whatever specifics (pricing, offer, features) the request actually mentions. Never invent pricing, guarantees, or specific feature claims the request didn't give you.
- "highlights": 3-6 short bullet phrases (each under 30 characters) suitable for a visual ad card — pull from real features/offer details in the request; if none given, keep this generic to the industry named (e.g. "Fast Setup", "24/7 Support").
- "hashtags": 6-10 relevant hashtags (no # symbol, just the words, CamelCase multi-word), mixing the industry, the action (e.g. SmallBusinessIndia), and the brand name if given.
- "cta_label": a short real Meta CTA button label — one of: "Shop Now", "Learn More", "Sign Up", "Get Quote", "Contact Us", "Book Now", "Download", "Call Now", "Apply Now". Pick based on objective (leads→"Get Quote" or "Sign Up"; sales→"Shop Now"; awareness→"Learn More").
- "city_names": real Indian city names explicitly mentioned or clearly implied by the request (e.g. "major cities" → list well-known Tier-1 cities). Empty array means target all of India — only leave it empty if the request gives no geographic hint at all.
- "age_min"/"age_max": infer a sensible professional/consumer age range for who'd actually act on this; default to 25-55 for B2B, 18-45 for general consumer unless the request implies otherwise.
- "genders": "all" unless the request clearly targets one gender.
- "daily_budget_inr": use the exact figure if the request states one; otherwise suggest a reasonable starting daily budget in INR for the objective (small, realistic — hundreds to low thousands, not fabricated precision).`;

export async function interpretCampaignPrompt(input: { prompt: string; brandProfile: BrandProfile | null }): Promise<CampaignPlan> {
  const { prompt, brandProfile } = input;

  const userContent = JSON.stringify(
    {
      request: prompt,
      brand: brandProfile
        ? {
            business_type: brandProfile.business_type,
            target_audience: brandProfile.target_audience,
            unique_selling_points: brandProfile.unique_selling_points,
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
    max_tokens: 1536,
    system: SYSTEM_PROMPT,
    output_config: { format: { type: "json_schema", schema: RESPONSE_SCHEMA } },
    messages: [{ role: "user", content: userContent }],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude returned no campaign plan");
  }

  const parsed = JSON.parse(textBlock.text) as {
    objective: CampaignPlan["objective"];
    headline: string;
    primary_text: string;
    highlights: string[];
    hashtags: string[];
    cta_label: string;
    city_names: string[];
    age_min: number;
    age_max: number;
    genders: CampaignPlan["genders"];
    daily_budget_inr: number;
  };

  return {
    objective: parsed.objective,
    headline: parsed.headline,
    primaryText: parsed.primary_text,
    highlights: parsed.highlights,
    hashtags: parsed.hashtags,
    ctaLabel: parsed.cta_label,
    cityNames: parsed.city_names,
    ageMin: parsed.age_min,
    ageMax: parsed.age_max,
    genders: parsed.genders,
    dailyBudgetInr: Math.max(100, parsed.daily_budget_inr),
  };
}
