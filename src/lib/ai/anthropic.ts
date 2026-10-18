// Backing LLM provider for every AI text feature in this app (ad copy,
// avatar/scene scripts, chatbot, business/lead analysis, agents, landing
// pages). Originally Claude — switched to Gemini (GEMINI_API_KEY) because
// the available Anthropic key had no credit balance. Every call site below
// this file is unchanged: they all call `getAnthropicClient().messages.
// create({ model, max_tokens, system, output_config, messages })` and read
// `response.content.find(b => b.type === "text").text`, so this file keeps
// that exact Anthropic-shaped interface as an adapter in front of Gemini's
// REST API — the "Anthropic" naming is legacy, not a provider claim.
// gemini-2.5-flash returns 404 for new projects as of this build (Google's
// own error recommends gemini-3.8-flash as the replacement) — verified live
// against the API, not guessed from training-data knowledge.
const GEMINI_MODEL = "gemini-3.8-flash";
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";

export function isAnthropicConfigured(): boolean {
  const key = process.env.GEMINI_API_KEY;
  return !!key && key !== "your_gemini_api_key";
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

/** Gemini's responseSchema is an OpenAPI-3.0-subset, not full JSON Schema — strips keywords it rejects. */
function toGeminiSchema(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(toGeminiSchema);
  if (schema && typeof schema === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(schema as Record<string, unknown>)) {
      if (key === "additionalProperties") continue;
      out[key] = toGeminiSchema(value);
    }
    return out;
  }
  return schema;
}

interface LLMClient {
  messages: { create(params: LLMCreateParams): Promise<LLMResponse> };
}

// Server-only — never import from a "use client" file.
export function getAnthropicClient(): LLMClient {
  return {
    messages: {
      async create(params: LLMCreateParams): Promise<LLMResponse> {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");

        const contents = params.messages.map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        }));

        // Without this, gemini-3.8-flash spends part of max_tokens on internal
        // "thinking" before answering — verified live: with it left default,
        // longer structured responses (e.g. 6+ scene objects) got cut off
        // mid-string instead of finishing. These call sites all want a direct
        // answer, not reasoning, so thinking is disabled outright.
        const generationConfig: Record<string, unknown> = {
          maxOutputTokens: params.max_tokens,
          thinkingConfig: { thinkingBudget: 0 },
        };
        if (params.output_config?.format.type === "json_schema") {
          generationConfig.responseMimeType = "application/json";
          generationConfig.responseSchema = toGeminiSchema(params.output_config.format.schema);
        }

        const body: Record<string, unknown> = { contents, generationConfig };
        if (params.system) body.systemInstruction = { parts: [{ text: params.system }] };

        const res = await fetch(`${GEMINI_API_BASE}/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error?.message ?? `Gemini API error (${res.status})`);
        }

        const candidate = data.candidates?.[0];
        const text = (candidate?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join("");
        if (!text) {
          throw new Error(candidate?.finishReason ? `Gemini returned no content (${candidate.finishReason})` : "Gemini returned no content");
        }

        return { content: [{ type: "text", text }] };
      },
    },
  };
}
