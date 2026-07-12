import type { LeadSource } from "@/types/database";

const HIGH_INTENT_SOURCES: LeadSource[] = ["website", "referral", "qr"];

// v1 heuristic — Module 5 (AI Business Analysis Engine) will replace this
// with real AI-driven scoring; ai_score/ai_score_reason already support it.
export function scoreLead(input: {
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  source: LeadSource;
}): { score: number; reason: string } {
  let score = 20;
  const reasons: string[] = [];

  if (input.email) {
    score += 20;
    reasons.push("has email");
  }
  if (input.phone) {
    score += 20;
    reasons.push("has phone");
  }
  if (input.company) {
    score += 15;
    reasons.push("provided a company");
  }
  if (HIGH_INTENT_SOURCES.includes(input.source)) {
    score += 15;
    reasons.push(`came via ${input.source}`);
  } else if (input.source === "csv") {
    score += 5;
  }

  score = Math.min(100, score);
  const reason = reasons.length > 0 ? `Scored on: ${reasons.join(", ")}.` : "Limited signal available yet.";

  return { score, reason };
}
