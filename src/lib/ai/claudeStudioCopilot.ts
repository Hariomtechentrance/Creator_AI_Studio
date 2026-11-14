import { getAnthropicClient } from "@/lib/ai/anthropic";
import type { BrandProfile } from "@/types/database";

export interface GeneratedSocialPost {
  title: string;
  caption: string;
  platforms: ("instagram" | "facebook" | "linkedin" | "twitter")[];
  hashtags: string[];
  mediaPrompt: string;
  suggestedDay?: number;
}

export interface GeneratedReel {
  title: string;
  hook: string;
  script: string;
  visualPrompt: string;
  durationSeconds: number;
}

export interface GeneratedAdCampaign {
  objective: "awareness" | "traffic" | "leads" | "sales" | "app_promotion";
  campaignName: string;
  headline: string;
  primaryText: string;
  cta: string;
  durationDays: number;
  dailyBudgetInr: number;
  totalBudgetInr: number;
  targetCities: string[];
  targetAudience: string;
  destinationUrl: string;
}

export interface ClaudeStudioPlan {
  summary: string;
  planType: "custom" | "monthly_growth_package" | "performance_traffic" | "app_download" | "social_bundle";
  socialPosts: GeneratedSocialPost[];
  reels: GeneratedReel[];
  adCampaign?: GeneratedAdCampaign;
  tokenCostCredits: number;
}

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    plan_type: {
      type: "string",
      enum: ["custom", "monthly_growth_package", "performance_traffic", "app_download", "social_bundle"],
    },
    social_posts: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          caption: { type: "string" },
          platforms: {
            type: "array",
            items: { type: "string", enum: ["instagram", "facebook", "linkedin", "twitter"] },
          },
          hashtags: { type: "array", items: { type: "string" } },
          media_prompt: { type: "string" },
          suggested_day: { type: "integer" },
        },
        required: ["title", "caption", "platforms", "hashtags", "media_prompt"],
        additionalProperties: false,
      },
    },
    reels: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          hook: { type: "string" },
          script: { type: "string" },
          visual_prompt: { type: "string" },
          duration_seconds: { type: "integer" },
        },
        required: ["title", "hook", "script", "visual_prompt", "duration_seconds"],
        additionalProperties: false,
      },
    },
    ad_campaign: {
      type: "object",
      properties: {
        objective: {
          type: "string",
          enum: ["awareness", "traffic", "leads", "sales", "app_promotion"],
        },
        campaign_name: { type: "string" },
        headline: { type: "string" },
        primary_text: { type: "string" },
        cta: { type: "string" },
        duration_days: { type: "integer" },
        daily_budget_inr: { type: "integer" },
        total_budget_inr: { type: "integer" },
        target_cities: { type: "array", items: { type: "string" } },
        target_audience: { type: "string" },
        destination_url: { type: "string" },
      },
      required: [
        "objective",
        "campaign_name",
        "headline",
        "primary_text",
        "cta",
        "duration_days",
        "daily_budget_inr",
        "total_budget_inr",
        "target_cities",
        "target_audience",
      ],
      additionalProperties: false,
    },
  },
  required: ["summary", "plan_type", "social_posts", "reels"],
  additionalProperties: false,
};

const SYSTEM_PROMPT = `You are Claude Studio Copilot inside CreatorAI Studio — the premier enterprise AI growth copilot for creators, businesses, and agency marketing teams.
The user enters natural language instructions (e.g. "Create 8 posts and 8 reels for this month and launch a 10-day awareness campaign on Meta", or "Create a viral video and ad campaign to get app downloads with clickable link").

Your job is to interpret their prompt, act as their master Creative Director & Performance Marketing Specialist, and produce a structured execution plan.

Guidelines:
1. "summary": Provide a clear, encouraging 2-3 sentence overview of what you constructed according to their prompt.
2. "plan_type":
   - "monthly_growth_package": when user asks for a monthly package (like 8 posts, 8 reels, awareness campaign)
   - "performance_traffic": when user asks for traffic / clicks / website visitors
   - "app_download": when user asks for app installs / downloads
   - "social_bundle": when user requests primarily social content or reels
   - "custom": any specific ad or custom creative request
3. "social_posts":
   - If the user specifies an exact count (e.g., 8 posts or 1 post), generate that count (max 8 in a single generation response to prevent timeout; if user asks for 8, return all 8 high-impact posts).
   - Write real, ready-to-publish captions with emotional hooks, line breaks, and clear call-to-actions.
   - "media_prompt": Flux/Midjourney-style photorealistic prompt for generating the image creative.
4. "reels":
   - If the user specifies video or reel count (e.g., 8 reels, 2 reels, or 1 reel), generate detailed reels (up to 8).
   - "hook": high-retention 0-3 second opener.
   - "script": timestamped spoken voiceover and visual instructions.
   - "visual_prompt": AI video prompt suitable for Kling AI, Runway, or HeyGen.
   - "duration_seconds": 15, 30, or 60.
5. "ad_campaign":
   - If the prompt mentions ads, paid promotion, awareness, traffic, leads, or app download, generate a complete campaign.
   - "objective": awareness (brand reach), traffic (website clicks), leads (form submissions), sales (purchases), or app_promotion (app installs/downloads).
   - "cta": "Learn More", "Download", "Get Quote", "Shop Now", "Sign Up", or "Install Now".
   - "daily_budget_inr" and "duration_days": infer from prompt or provide realistic SMB standards (e.g. ₹500/day for 10 days = ₹5,000 total).
   - "target_cities": target locations mentioned or key hubs (e.g., Mumbai, Delhi, Bengaluru, Pune).
`;

export async function executeClaudeStudioPrompt(input: {
  prompt: string;
  brandProfile?: BrandProfile | null;
  orgName?: string;
  destinationUrl?: string;
}): Promise<ClaudeStudioPlan> {
  const { prompt, brandProfile, orgName, destinationUrl } = input;

  const userContent = JSON.stringify(
    {
      user_prompt: prompt,
      brand: brandProfile
        ? {
            name: orgName ?? "Our Brand",
            business_type: brandProfile.business_type,
            target_audience: brandProfile.target_audience,
            unique_selling_points: brandProfile.unique_selling_points,
            tone: brandProfile.tone_of_voice,
          }
        : { name: orgName ?? "Our Brand" },
      destination_url: destinationUrl || "https://example.com",
    },
    null,
    2,
  );

  const client = getAnthropicClient();
  const response = await client.messages.create({
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    output_config: { format: { type: "json_schema", schema: RESPONSE_SCHEMA } },
    messages: [{ role: "user", content: userContent }],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude Copilot did not return an execution plan");
  }

  const parsed = JSON.parse(textBlock.text);

  interface RawPost {
    title?: string;
    caption: string;
    platforms?: ("instagram" | "facebook" | "linkedin" | "twitter")[];
    hashtags?: string[];
    media_prompt?: string;
    suggested_day?: number;
  }

  interface RawReel {
    title?: string;
    hook: string;
    script: string;
    visual_prompt: string;
    duration_seconds?: number;
  }

  const socialPosts: GeneratedSocialPost[] = ((parsed.social_posts || []) as RawPost[]).map((p, idx) => ({
    title: p.title || `Post #${idx + 1}`,
    caption: p.caption,
    platforms: Array.isArray(p.platforms) ? p.platforms : ["instagram", "facebook"],
    hashtags: Array.isArray(p.hashtags) ? p.hashtags : [],
    mediaPrompt: p.media_prompt || "",
    suggestedDay: p.suggested_day || idx + 1,
  }));

  const reels: GeneratedReel[] = ((parsed.reels || []) as RawReel[]).map((r, idx) => ({
    title: r.title || `Reel #${idx + 1}`,
    hook: r.hook,
    script: r.script,
    visualPrompt: r.visual_prompt,
    durationSeconds: r.duration_seconds || 15,
  }));

  let adCampaign: GeneratedAdCampaign | undefined = undefined;
  if (parsed.ad_campaign && parsed.ad_campaign.headline) {
    adCampaign = {
      objective: parsed.ad_campaign.objective || "awareness",
      campaignName: parsed.ad_campaign.campaign_name || "Claude Growth Campaign",
      headline: parsed.ad_campaign.headline,
      primaryText: parsed.ad_campaign.primary_text,
      cta: parsed.ad_campaign.cta || "Learn More",
      durationDays: parsed.ad_campaign.duration_days || 10,
      dailyBudgetInr: parsed.ad_campaign.daily_budget_inr || 500,
      totalBudgetInr: parsed.ad_campaign.total_budget_inr || (parsed.ad_campaign.daily_budget_inr || 500) * (parsed.ad_campaign.duration_days || 10),
      targetCities: Array.isArray(parsed.ad_campaign.target_cities) ? parsed.ad_campaign.target_cities : [],
      targetAudience: parsed.ad_campaign.target_audience || "Targeted Consumers",
      destinationUrl: parsed.ad_campaign.destination_url || destinationUrl || "https://example.com",
    };
  }

  // Credit calculation: base 25 credits for Claude Copilot generation
  // + 5 credits per post + 10 credits per reel
  const tokenCostCredits = 25 + socialPosts.length * 5 + reels.length * 10;

  return {
    summary: parsed.summary || "Your custom creative package and campaign plan are ready.",
    planType: parsed.plan_type || "custom",
    socialPosts,
    reels,
    adCampaign,
    tokenCostCredits,
  };
}
