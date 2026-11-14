import Anthropic from "@anthropic-ai/sdk";

// Backing LLM provider for every AI text feature in this app (ad copy,
// avatar/scene scripts, chatbot, business/lead analysis, agents, landing
// pages, and Claude Studio Copilot).
// Primary provider: Anthropic Claude (claude-3-5-sonnet, claude-3-7-sonnet, claude-3-5-haiku).
// Fallback provider: Groq OpenAI-compatible API (ensures zero downtime if Anthropic key is dry).

const DEFAULT_CLAUDE_MODEL = "claude-3-5-sonnet-20241022";
const GROQ_MODEL = "openai/gpt-oss-120b";
const GROQ_API_BASE = "https://api.groq.com/openai/v1";

export function isAnthropicConfigured(): boolean {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;
  return (
    (!!anthropicKey && anthropicKey !== "your_anthropic_api_key") ||
    (!!groqKey && groqKey !== "your_groq_api_key")
  );
}

interface LLMMessage {
  role: "user" | "assistant";
  content: string;
}

interface LLMCreateParams {
  model: string;
  max_tokens: number;
  system?: string;
  output_config?: { format: { type: "json_schema"; schema: Record<string, unknown> } };
  messages: LLMMessage[];
}

interface LLMTextBlock {
  type: "text";
  text: string;
}

interface LLMResponse {
  content: LLMTextBlock[];
}

interface LLMClient {
  messages: { create(params: LLMCreateParams): Promise<LLMResponse> };
}

async function callGroqFallback(params: LLMCreateParams): Promise<LLMResponse> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("Neither ANTHROPIC_API_KEY nor GROQ_API_KEY is configured");

  const messages: Array<{ role: string; content: string }> = [];
  let system = params.system ?? "";
  if (params.output_config?.format.type === "json_schema") {
    system += `\n\nRespond with ONLY valid JSON matching exactly this JSON Schema, no other text:\n${JSON.stringify(params.output_config.format.schema)}`;
  }
  if (system) messages.push({ role: "system", content: system });
  for (const m of params.messages) messages.push({ role: m.role, content: m.content });

  const body: Record<string, unknown> = {
    model: GROQ_MODEL,
    max_tokens: params.max_tokens,
    reasoning_effort: "low",
    messages,
  };
  if (params.output_config?.format.type === "json_schema") {
    body.response_format = { type: "json_object" };
  }

  const res = await fetch(`${GROQ_API_BASE}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message ?? `Groq API error (${res.status})`);
  }

  const text = data.choices?.[0]?.message?.content ?? "";
  if (!text) {
    throw new Error(data.choices?.[0]?.finish_reason ? `Groq returned no content (${data.choices[0].finish_reason})` : "Groq returned no content");
  }

  return { content: [{ type: "text", text }] };
}

// Server-only — never import from a "use client" file.
export function getAnthropicClient(): LLMClient {
  return {
    messages: {
      async create(params: LLMCreateParams): Promise<LLMResponse> {
        const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
        const hasAnthropic = !!anthropicApiKey && anthropicApiKey !== "your_anthropic_api_key";

        if (hasAnthropic) {
          try {
            const client = new Anthropic({ apiKey: anthropicApiKey });
            let system = params.system ?? "";
            if (params.output_config?.format.type === "json_schema") {
              system += `\n\nRespond with ONLY valid JSON matching exactly this JSON Schema, no other text:\n${JSON.stringify(params.output_config.format.schema)}`;
            }

            const model = params.model.startsWith("claude-") ? params.model : DEFAULT_CLAUDE_MODEL;

            const res = await client.messages.create({
              model,
              max_tokens: params.max_tokens || 2048,
              system: system || undefined,
              messages: params.messages.map((m) => ({
                role: m.role,
                content: m.content,
              })),
            });

            const textBlocks: LLMTextBlock[] = [];
            for (const block of res.content) {
              if (block.type === "text") {
                textBlocks.push({ type: "text", text: block.text });
              }
            }

            if (textBlocks.length > 0) {
              return { content: textBlocks };
            }
          } catch (err) {
            console.warn("[Claude API] Failed, switching to Groq fallback:", err instanceof Error ? err.message : err);
          }
        }

        return callGroqFallback(params);
      },
    },
  };
}
