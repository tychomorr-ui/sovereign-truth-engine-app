import { ENV } from "./_core/env";
import { getConfiguredLocalModelProvider, type ContextBoundary } from "./local-model";

export type LocalRole = "user" | "assistant";

export type LocalChatMessage = {
  role: LocalRole;
  content: string;
};

export type LocalGatewayRequest = {
  system: string;
  messages: LocalChatMessage[];
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  contextBoundary?: ContextBoundary;
};

export type LocalGatewayResponse = {
  content: string;
  modelId: string;
  stopReason?: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
  provider: "local" | "deterministic";
};

export function isLocalModelConfigured(): boolean {
  return Boolean(ENV.localLlmBaseUrl && ENV.localLlmModel);
}

export function getLocalProvider(): "local" | "deterministic" {
  return isLocalModelConfigured() ? "local" : "deterministic";
}

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/$/, "");
}

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.trim().length / 4));
}

function latestUserMessage(messages: LocalChatMessage[]): string {
  return [...messages].reverse().find((message) => message.role === "user")?.content.trim() ?? "";
}

/**
 * Offline fallback. It is intentionally transparent and bounded: it does not
 * pretend to be a language model, browse the web, or invent sources.
 */
export function deterministicResponse(request: LocalGatewayRequest): LocalGatewayResponse {
  const question = latestUserMessage(request.messages);
  const normalized = question.toLowerCase();
  let content: string;

  if (!question) {
    content = "No operator message was supplied. Provide a question or instruction to begin.";
  } else if (/\b(hello|hi|hey)\b/.test(normalized) && question.length < 80) {
    content = `Hello. I am KEIRA's local deterministic runtime. I can organize, clarify, compare, and transform the information you provide. What would you like to examine?`;
  } else if (/\b(capabilit|can you|what are you)\b/.test(normalized)) {
    content = "The current runtime can preserve conversation history, apply the operator-owned context ledger, follow saved response controls, and produce bounded deterministic replies. A self-hosted local model can be enabled with LOCAL_LLM_BASE_URL and LOCAL_LLM_MODEL. Live web research, hidden knowledge, and unsupported claims are not active by default.";
  } else {
    content = [
      "Deterministic runtime response.",
      "",
      `Request received: ${question}`,
      "",
      "No local language model is configured, so I will not simulate one. I can still help by structuring the request, identifying assumptions, and defining the next verifiable step.",
      "",
      "Suggested next step: configure a self-hosted OpenAI-compatible endpoint if you want generative local inference (for example Ollama at http://127.0.0.1:11434/v1), then retry this message.",
    ].join("\n");
  }

  const inputTokens = estimateTokens(request.system + request.messages.map((message) => message.content).join("\n"));
  const outputTokens = estimateTokens(content);
  return {
    content,
    modelId: "deterministic-v1",
    stopReason: "stop",
    provider: "deterministic",
    usage: { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens },
  };
}

async function invokeOpenAiCompatible(request: LocalGatewayRequest): Promise<LocalGatewayResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ENV.localLlmTimeoutMs);
  const messages = [
    { role: "system", content: request.system },
    ...request.messages,
  ];

  try {
    const response = await fetch(`${normalizeBaseUrl(ENV.localLlmBaseUrl)}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(ENV.localLlmApiKey ? { Authorization: `Bearer ${ENV.localLlmApiKey}` } : {}),
      },
      body: JSON.stringify({
        model: ENV.localLlmModel,
        messages,
        max_tokens: request.maxTokens ?? ENV.localLlmMaxTokens,
        temperature: request.temperature ?? ENV.localLlmTemperature,
        top_p: request.topP ?? ENV.localLlmTopP,
      }),
    });

    if (!response.ok) {
      throw new Error(`Local model request failed with status ${response.status}.`);
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: unknown }; finish_reason?: string }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    };
    const content = payload.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) {
      throw new Error("Local model returned an empty response.");
    }

    return {
      content: content.trim(),
      modelId: ENV.localLlmModel,
      stopReason: payload.choices?.[0]?.finish_reason,
      provider: "local",
      usage: payload.usage
        ? {
            inputTokens: payload.usage.prompt_tokens,
            outputTokens: payload.usage.completion_tokens,
            totalTokens: payload.usage.total_tokens,
          }
        : undefined,
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Local model request timed out.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function invokeLocal(request: LocalGatewayRequest): Promise<LocalGatewayResponse> {
  if (!isLocalModelConfigured()) return deterministicResponse(request);
  const response = await getConfiguredLocalModelProvider().generate(request);
  return {
    content: response.content,
    modelId: response.modelId,
    stopReason: response.stopReason,
    provider: "local",
    usage: response.usage,
  };
}

export function resetLocalGatewayForTests(): void {
  // Kept as an explicit test seam; the local gateway has no persistent client.
}
