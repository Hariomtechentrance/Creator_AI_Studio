// Backing LLM provider for every AI text feature in this app (ad copy,
// avatar/scene scripts, chatbot, business/lead analysis, agents, landing
// pages). Originally Claude — swapped to Gemini when the Anthropic key had
// no credit, then swapped again to Groq (free tier, no card) when Gemini's
// free tier started failing with 503 "high demand" errors (verified live,
// not guessed). Every call site below this file is unchanged: they all call
// `getAnthropicClient().messages.create({ model, max_tokens, system,
// output_config, messages })` and read `response.content.find(b => b.type
// === "text").text`, so this file keeps that exact Anthropic-shaped
// interface as an adapter in front of Groq's OpenAI-compatible API — the
// "Anthropic" naming is legacy, not a provider claim.
// Verified live against this account's actual model list (Groq's lineup has
// shifted away from Llama toward OpenAI's open-weight gpt-oss models) —
// llama-3.3-70b-versatile 404s now, gpt-oss-120b is the largest available.
const GROQ_MODEL = "openai/gpt-oss-120b";
const GROQ_API_BASE = "https://api.groq.com/openai/v1";

export function isAnthropicConfigured(): boolean {
  const key = process.env.GROQ_API_KEY;
  return !!key && key !== "your_groq_api_key";
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

// Server-only — never import from a "use client" file.
export function getAnthropicClient(): LLMClient {
  return {
    messages: {
      async create(params: LLMCreateParams): Promise<LLMResponse> {
        const apiKey = process.env.GROQ_API_KEY;
        if (!apiKey) throw new Error("GROQ_API_KEY is not configured");

        const messages: Array<{ role: string; content: string }> = [];
        let system = params.system ?? "";
        // Groq's JSON mode (unlike Gemini's responseSchema) only guarantees
        // *valid JSON*, not a specific shape — so the schema is spelled out
        // in the system prompt itself to steer the model toward matching it.
        if (params.output_config?.format.type === "json_schema") {
          system += `\n\nRespond with ONLY valid JSON matching exactly this JSON Schema, no other text:\n${JSON.stringify(params.output_config.format.schema)}`;
        }
        if (system) messages.push({ role: "system", content: system });
        for (const m of params.messages) messages.push({ role: m.role, content: m.content });

        const body: Record<string, unknown> = {
          model: GROQ_MODEL,
          max_tokens: params.max_tokens,
          // gpt-oss is a reasoning model that otherwise spends part of
          // max_tokens "thinking" before answering — verified live: left at
          // the default, short completions got cut off with empty content
          // (finish_reason "length") before any real text came out. "low"
          // leaves enough budget for the actual answer, same fix this file
          // already needed once before for Gemini's equivalent behavior.
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
      },
    },
  };
}
