import { getAnthropicClient } from "@/lib/ai/anthropic";
import type { BrandProfile } from "@/types/database";

export interface CampaignPlan {
  objective: "awareness" | "leads" | "sales" | "engagement" | "traffic";
  isB2B: boolean;
  headline: string;
  primaryText: string;
  highlights: string[];
  hashtags: string[];
  ctaLabel: string;
  cityNames: string[];
  interestQueries: string[];
  ageMin: number;
  ageMax: number;
  genders: "all" | "male" | "female";
  dailyBudgetInr: number;
}

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    objective: { type: "string", enum: ["awareness", "leads", "sales", "engagement", "traffic"] },
    is_b2b: { type: "boolean" },
    headline: { type: "string" },
    primary_text: { type: "string" },
    highlights: { type: "array", items: { type: "string" } },
    hashtags: { type: "array", items: { type: "string" } },
    cta_label: { type: "string" },
    city_names: { type: "array", items: { type: "string" } },
    interest_queries: { type: "array", items: { type: "string" } },
    age_min: { type: "integer" },
    age_max: { type: "integer" },
    genders: { type: "string", enum: ["all", "male", "female"] },
    daily_budget_inr: { type: "integer" },
  },
  required: [
    "objective",
    "is_b2b",
    "headline",
    "primary_text",
    "highlights",
    "hashtags",
    "cta_label",
    "city_names",
    "interest_queries",
    "age_min",
    "age_max",
    "genders",
    "daily_budget_inr",
  ],
  additionalProperties: false,
};

const SYSTEM_PROMPT = `You turn one plain-language campaign request from an Indian SMB owner into a complete, structured Meta Ads campaign plan. Read the request carefully and extract everything it actually says before inventing anything.

Rules:
- "objective": pick the single closest match — awareness (brand/reach), leads (collect enquiries/contact details), sales (drive purchases), engagement (likes/comments/messages), traffic (website visits). Infer from phrases like "get calls", "collect leads", "drive sales", "brand awareness".
- "is_b2b": true if the request is targeting businesses, workshops, garages, dealers, wholesale, or corporate clients (e.g. "Car modules", "B2B leads", "resellers", "distributors", "spare parts shop"). False for consumer B2C products.
- "headline": under 60 characters, a real hook. CRITICAL: If is_b2b is true, the headline MUST state the target audience directly (e.g., "For Garage Owners: Quality Car Modules" or "Wholesale ECMs & Modules for Auto Workshops") to repel casual consumers and eliminate junk clicks.
- "primary_text": 3-5 sentences of real ad body copy. If is_b2b is true, clearly state business qualifiers (e.g., "Serving auto repair shops, garages, and spare parts dealers across India. Bulk pricing and 6-month warranty available. Inquire with your workshop name.").
- "highlights": 3-6 short bullet phrases (each under 30 characters) suitable for a visual ad card.
- "hashtags": 6-10 relevant hashtags (no # symbol, just the words, CamelCase multi-word).
- "cta_label": a short real Meta CTA button label — one of: "Shop Now", "Learn More", "Sign Up", "Get Quote", "Contact Us", "Book Now", "Download", "Call Now", "Apply Now". For B2B leads, use "Get Quote" or "Contact Us".
- "city_names": real Indian city names explicitly mentioned or clearly implied by the request. Empty array means target all of India.
- "interest_queries": 2-5 relevant Meta interest or industry search keywords for targeted audience matching (e.g., for B2B car modules: ["Automobile repair shop", "Mechanic", "Auto parts", "Commercial vehicle"]).
- "age_min"/"age_max": infer a sensible range (for B2B set minimum age to 24 or 25 to filter out students/teens).
- "genders": "all" unless the request clearly targets one gender.
- "daily_budget_inr": use the exact figure if the request states one; otherwise suggest a realistic daily budget (e.g. ₹500 - ₹1000/day).`;

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
    is_b2b?: boolean;
    headline: string;
    primary_text: string;
    highlights: string[];
    hashtags: string[];
    cta_label: string;
    city_names: string[];
    interest_queries?: string[];
    age_min: number;
    age_max: number;
    genders: CampaignPlan["genders"];
    daily_budget_inr: number;
  };

  return {
    objective: parsed.objective,
    isB2B: !!parsed.is_b2b,
    headline: parsed.headline,
    primaryText: parsed.primary_text,
    highlights: parsed.highlights,
    hashtags: parsed.hashtags,
    ctaLabel: parsed.cta_label,
    cityNames: parsed.city_names,
    interestQueries: Array.isArray(parsed.interest_queries) ? parsed.interest_queries : [],
    ageMin: parsed.age_min,
    ageMax: parsed.age_max,
    genders: parsed.genders,
    dailyBudgetInr: Math.max(100, parsed.daily_budget_inr),
  };
}
