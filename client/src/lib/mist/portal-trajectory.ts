import type { CorpusIngestInput } from "../corpus/types";

export type PortalTrajectoryMessage = {
  role: "user" | "portal";
  content: string;
};

export function createPortalTrajectoryCorpusInput(
  conversationId: number,
  title: string | undefined,
  messages: PortalTrajectoryMessage[],
): CorpusIngestInput {
  return {
    filename: `portal-conversation-${conversationId}.txt`,
    mimeType: "text/plain",
    title: title?.trim() || "Portal conversation",
    source: "portal-chat",
    role: "dialogue",
    scope: "operator-local",
    tags: ["portal", "conversation", String(conversationId)],
    content: messages
      .map((message) => `${message.role === "user" ? "Operator" : "KEIRA"}: ${message.content}`)
      .join("\n\n"),
  };
}
