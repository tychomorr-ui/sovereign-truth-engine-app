import { invokeLocal } from "../local-gateway";

export type Role = "system" | "user" | "assistant" | "tool" | "function";

export type TextContent = { type: "text"; text: string };
export type ImageContent = {
  type: "image_url";
  image_url: { url: string; detail?: "auto" | "low" | "high" };
};
export type FileContent = {
  type: "file_url";
  file_url: {
    url: string;
    mime_type?: "audio/mpeg" | "audio/wav" | "application/pdf" | "audio/mp4" | "video/mp4";
  };
};

export type MessageContent = string | TextContent | ImageContent | FileContent;
export type Message = {
  role: Role;
  content: MessageContent | MessageContent[];
  name?: string;
  tool_call_id?: string;
};

export type Tool = {
  type: "function";
  function: { name: string; description?: string; parameters?: Record<string, unknown> };
};
export type ToolChoice = "none" | "auto" | "required" | { name: string } | {
  type: "function";
  function: { name: string };
};
export type JsonSchema = { name: string; schema: Record<string, unknown>; strict?: boolean };
export type OutputSchema = JsonSchema;
export type ResponseFormat =
  | { type: "text" }
  | { type: "json_object" }
  | { type: "json_schema"; json_schema: JsonSchema };

export type InvokeParams = {
  messages: Message[];
  tools?: Tool[];
  toolChoice?: ToolChoice;
  tool_choice?: ToolChoice;
  maxTokens?: number;
  max_tokens?: number;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
};

export type ToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};
export type InvokeResult = {
  id: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: Role;
      content: string | Array<TextContent | ImageContent | FileContent>;
      tool_calls?: ToolCall[];
    };
    finish_reason: string | null;
  }>;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
};

function contentToText(content: MessageContent | MessageContent[]): string {
  const parts = Array.isArray(content) ? content : [content];
  return parts.map((part) => {
    if (typeof part === "string") return part;
    if (part.type === "text") return part.text;
    throw new Error("The local compatibility adapter accepts text content only.");
  }).join("\n").trim();
}

function appendMessage(
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  role: "user" | "assistant",
  content: string,
): void {
  const previous = messages.at(-1);
  if (previous?.role === role) {
    previous.content = `${previous.content}\n\n${content}`;
    return;
  }
  messages.push({ role, content });
}

function schemaInstruction(params: InvokeParams): string | null {
  const format = params.responseFormat ?? params.response_format;
  const schema = params.outputSchema ?? params.output_schema;
  if (format?.type === "json_object") return "Return valid JSON only.";
  if (format?.type === "json_schema") {
    return `Return valid JSON only, conforming to this schema: ${JSON.stringify(format.json_schema.schema)}`;
  }
  if (schema) return `Return valid JSON only, conforming to this schema: ${JSON.stringify(schema.schema)}`;
  return null;
}

/**
 * Compatibility entrypoint for inactive legacy modules. It preserves the former
 * OpenAI-shaped result contract while routing through a self-hosted local model
 * or a transparent deterministic fallback. Tool execution is intentionally not emulated.
 */
export async function invokeLLM(params: InvokeParams): Promise<InvokeResult> {
  if (params.tools?.length) {
    throw new Error("Tool execution is not available through the local compatibility adapter.");
  }

  const systemParts: string[] = [
    "You are Portal, a precise and conversational intelligence system.",
  ];
  const chatMessages: Array<{ role: "user" | "assistant"; content: string }> = [];

  for (const message of params.messages) {
    const text = contentToText(message.content);
    if (!text) continue;
    if (message.role === "system") {
      systemParts.push(text);
      continue;
    }
    const role = message.role === "assistant" ? "assistant" : "user";
    appendMessage(chatMessages, role, message.role === "tool" || message.role === "function"
      ? `[Tool context]\n${text}`
      : text);
  }

  const instruction = schemaInstruction(params);
  if (instruction) systemParts.push(instruction);
  if (!chatMessages.length) {
    throw new Error("At least one non-system message is required for local invocation.");
  }

  const response = await invokeLocal({
    system: systemParts.join("\n\n"),
    messages: chatMessages,
    maxTokens: params.maxTokens ?? params.max_tokens,
  });

  return {
    id: `${response.provider}-${crypto.randomUUID()}`,
    created: Math.floor(Date.now() / 1000),
    model: response.modelId,
    choices: [{
      index: 0,
      message: { role: "assistant", content: response.content },
      finish_reason: response.stopReason ?? "stop",
    }],
    usage: response.usage ? {
      prompt_tokens: response.usage.inputTokens ?? 0,
      completion_tokens: response.usage.outputTokens ?? 0,
      total_tokens: response.usage.totalTokens ?? 0,
    } : undefined,
  };
}
