import { getAnthropicClient } from "@/lib/ai/anthropic";
import type { BrandProfile, Organization, Lead, Campaign, AIReport } from "@/types/database";

export type AgentType = "marketing" | "consultant";

const SYSTEM_PROMPTS: Record<AgentType, string> = {
  marketing: `You are the Marketing AI Agent for a small business — a conversational advisor for content planning, social media strategy, and campaign suggestions.

Rules:
- Only reason from the business context given below (brand profile, campaigns, latest AI report). Never invent metrics, past campaign results, or follower counts that weren't given.
- If asked about trend analysis or live platform data, say honestly that no social platform is connected yet, and give general best-practice guidance instead.
- Be specific and actionable — reference the business's actual industry, audience, and offerings when suggesting content ideas or campaign angles.
- Keep replies conversational and concise, not a wall of bullet points, unless the user asks for a list.`,
  consultant: `You are the Business Consultant AI — a strategic advisor synthesizing marketing/lead data into growth advice.

Rules:
- Only reason from the data given below (brand profile including competitors, lead stats, latest AI report). Never invent revenue figures, market size, or competitor details beyond what's given.
- For revenue forecasting: only project from the actual converted-lead value trend provided. Explicitly caveat that this is a rough estimate from limited data, not a financial model.
- For competitor analysis: only use the competitors the business owner entered in their brand profile — if none were entered, say so and ask what competitors to analyze instead of inventing names.
- Be direct and consultative — like a strategist in a working session, not a generic listicle.`,
};

export async function chatWithAgent(input: {
  agentType: AgentType;
  org: Organization;
  brandProfile: BrandProfile | null;
  leads: Lead[];
  campaigns: Campaign[];
  latestReport: AIReport | null;
  history: { role: "user" | "assistant"; content: string }[];
  message: string;
}): Promise<string> {
  const { agentType, org, brandProfile, leads, campaigns, latestReport, history, message } = input;

  const converted = leads.filter((l) => l.status === "converted");
  const context = {
    business: { name: org.name, industry: org.industry, description: org.description },
    brand_profile: brandProfile
      ? {
          business_type: brandProfile.business_type,
          target_audience: brandProfile.target_audience,
          unique_selling_points: brandProfile.unique_selling_points,
          competitors: brandProfile.competitors,
          primary_goal: brandProfile.primary_goal,
          current_platforms: brandProfile.current_platforms,
          monthly_budget_range: brandProfile.monthly_budget_range,
        }
      : null,
    lead_stats: {
      total: leads.length,
      converted: converted.length,
      conversion_rate_pct: leads.length > 0 ? Math.round((converted.length / leads.length) * 100) : 0,
      total_converted_value: converted.reduce((sum, l) => sum + (l.converted_value ?? 0), 0),
    },
    campaigns: campaigns.map((c) => ({ name: c.name, platforms: c.platforms, goal: c.goal, status: c.status })),
    latest_ai_report: latestReport
      ? { insights: latestReport.insights, opportunities: latestReport.opportunities, recommendations: latestReport.recommendations }
      : null,
  };

  const client = getAnthropicClient();
  const response = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 1024,
    system: `${SYSTEM_PROMPTS[agentType]}\n\nBusiness context:\n${JSON.stringify(context, null, 2)}`,
    messages: [...history, { role: "user", content: message }],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("The agent returned no reply");
  }
  return textBlock.text;
}
