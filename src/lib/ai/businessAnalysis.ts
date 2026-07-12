import { getAnthropicClient } from "@/lib/ai/anthropic";
import type { Organization, BrandProfile, Lead } from "@/types/database";

export interface InsightItem {
  title: string;
  detail: string;
}

export interface BusinessAnalysisResult {
  brandSummary: string;
  contentPillars: string[];
  recommendedPlatforms: string[];
  insights: InsightItem[];
  redFlags: InsightItem[];
  opportunities: InsightItem[];
  recommendations: InsightItem[];
}

interface LeadStats {
  total: number;
  converted: number;
  conversionRatePct: number;
  bySource: Record<string, number>;
  byStatus: Record<string, number>;
  averageScoreBySource: Record<string, number>;
}

function computeLeadStats(leads: Lead[]): LeadStats {
  const bySource: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  const scoreSumBySource: Record<string, number> = {};

  for (const lead of leads) {
    bySource[lead.source] = (bySource[lead.source] ?? 0) + 1;
    byStatus[lead.status] = (byStatus[lead.status] ?? 0) + 1;
    scoreSumBySource[lead.source] = (scoreSumBySource[lead.source] ?? 0) + lead.ai_score;
  }

  const averageScoreBySource: Record<string, number> = {};
  for (const source of Object.keys(bySource)) {
    averageScoreBySource[source] = Math.round(scoreSumBySource[source] / bySource[source]);
  }

  const converted = byStatus.converted ?? 0;

  return {
    total: leads.length,
    converted,
    conversionRatePct: leads.length > 0 ? Math.round((converted / leads.length) * 100) : 0,
    bySource,
    byStatus,
    averageScoreBySource,
  };
}

const INSIGHT_ITEM_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    detail: { type: "string" },
  },
  required: ["title", "detail"],
  additionalProperties: false,
};

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    brand_summary: { type: "string" },
    content_pillars: { type: "array", items: { type: "string" } },
    recommended_platforms: { type: "array", items: { type: "string" } },
    insights: { type: "array", items: INSIGHT_ITEM_SCHEMA },
    red_flags: { type: "array", items: INSIGHT_ITEM_SCHEMA },
    opportunities: { type: "array", items: INSIGHT_ITEM_SCHEMA },
    recommendations: { type: "array", items: INSIGHT_ITEM_SCHEMA },
  },
  required: [
    "brand_summary",
    "content_pillars",
    "recommended_platforms",
    "insights",
    "red_flags",
    "opportunities",
    "recommendations",
  ],
  additionalProperties: false,
};

const SYSTEM_PROMPT = `You are a marketing strategist for Indian SMBs, analyzing one business's brand profile and lead data to produce a strategy summary and actionable insights.

Rules:
- Only reason from the data given to you below. Never invent metrics, campaigns, platforms, response times, or ad spend figures that were not provided.
- If lead data is sparse or empty, say so plainly in an insight or red flag instead of fabricating a trend.
- Every "detail" field must reference the actual numbers, sources, or fields given — no generic filler.
- Recommendations must be concrete next steps the business owner can act on this week, not generic marketing advice.`;

export async function analyzeBusiness(input: {
  org: Organization;
  brandProfile: BrandProfile;
  leads: Lead[];
}): Promise<BusinessAnalysisResult> {
  const { org, brandProfile, leads } = input;
  const leadStats = computeLeadStats(leads);

  const userContent = JSON.stringify(
    {
      business: {
        name: org.name,
        industry: org.industry,
        description: org.description,
      },
      brand_profile: {
        target_audience: brandProfile.target_audience,
        tone_of_voice: brandProfile.tone_of_voice,
        unique_selling_points: brandProfile.unique_selling_points,
        competitors: brandProfile.competitors,
        primary_goal: brandProfile.primary_goal,
        current_platforms: brandProfile.current_platforms,
        monthly_budget_range: brandProfile.monthly_budget_range,
      },
      lead_stats: leadStats,
    },
    null,
    2,
  );

  const client = getAnthropicClient();
  const response = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    output_config: { format: { type: "json_schema", schema: RESPONSE_SCHEMA } },
    messages: [{ role: "user", content: userContent }],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude returned no analysis text");
  }

  const parsed = JSON.parse(textBlock.text) as {
    brand_summary: string;
    content_pillars: string[];
    recommended_platforms: string[];
    insights: InsightItem[];
    red_flags: InsightItem[];
    opportunities: InsightItem[];
    recommendations: InsightItem[];
  };

  return {
    brandSummary: parsed.brand_summary,
    contentPillars: parsed.content_pillars,
    recommendedPlatforms: parsed.recommended_platforms,
    insights: parsed.insights,
    redFlags: parsed.red_flags,
    opportunities: parsed.opportunities,
    recommendations: parsed.recommendations,
  };
}
