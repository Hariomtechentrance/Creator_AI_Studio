import Anthropic from "@anthropic-ai/sdk";

export function isAnthropicConfigured(): boolean {
  const key = process.env.ANTHROPIC_API_KEY;
  return !!key && key !== "your_anthropic_api_key";
}

// Server-only — never import from a "use client" file.
export function getAnthropicClient(): Anthropic {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}
