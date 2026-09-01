import Anthropic from "@anthropic-ai/sdk";

export function isAnthropicConfigured(): boolean {
  const key = process.env.ANTHROPIC_API_KEY;
  return !!key && key !== "your_anthropic_api_key";
}

// Server-only — never import from a "use client" file.
export function getAnthropicClient(): Anthropic {
  // Workspace-scoped ("identity-linked") API keys reject every request unless
  // they carry the workspace id. Set ANTHROPIC_WORKSPACE_ID for those; a
  // plain org-level key works without it.
  const workspaceId = process.env.ANTHROPIC_WORKSPACE_ID;
  return new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    ...(workspaceId ? { defaultHeaders: { "anthropic-workspace-id": workspaceId } } : {}),
  });
}
