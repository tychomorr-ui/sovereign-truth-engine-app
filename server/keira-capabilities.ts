import { getLocalProvider, isLocalModelConfigured } from "./local-gateway";

export type KeiraCapabilityStatus = "available" | "awaiting-configuration" | "browser-dependent";

export type KeiraCapability = {
  id:
    | "reasoning"
    | "conversation-memory"
    | "context-ledger"
    | "transcript-export"
    | "voice"
    | "realtime-voice"
    | "research"
    | "personalization"
    | "response-calibration";
  label: string;
  status: KeiraCapabilityStatus;
  detail: string;
};

export function getKeiraCapabilities(): KeiraCapability[] {
  const localReady = isLocalModelConfigured();
  const provider = getLocalProvider();

  return [
    {
      id: "reasoning",
      label: localReady ? "Self-hosted local reasoning" : "Deterministic runtime",
      status: "available",
      detail: localReady
        ? "Inference is routed to the configured operator-controlled OpenAI-compatible local model endpoint."
        : "A bounded deterministic responder is active. No remote model, cloud inference, or fabricated intelligence is implied.",
    },
    {
      id: "conversation-memory",
      label: "Conversation continuity",
      status: "available",
      detail: "Threads, messages, and operator preferences are persisted in the application data store.",
    },
    {
      id: "context-ledger",
      label: "Context ledger",
      status: "available",
      detail: "Operator-owned context entries can be reviewed, activated, paused, or removed before they influence future responses.",
    },
    {
      id: "transcript-export",
      label: "Transcript export",
      status: "available",
      detail: "The current conversation can be exported directly from the console as a local JSON transcript.",
    },
    {
      id: "voice",
      label: "Voice interaction",
      status: "browser-dependent",
      detail: "Speech input and output depend on the browser and locally installed voices; no synthetic voice availability is implied.",
    },
    {
      id: "realtime-voice",
      label: "Realtime voice",
      status: "awaiting-configuration",
      detail: "Natural low-latency interruption and streaming speech require a separately configured local voice runtime; browser voice remains the current fallback.",
    },
    {
      id: "research",
      label: "Cited research",
      status: "awaiting-configuration",
      detail: "Research mode is inactive until a local retrieval and source-citation workflow is configured.",
    },
    {
      id: "personalization",
      label: "Operator settings",
      status: "available",
      detail: "Persona, instructions, response calibration, avatar, and voice preferences can be stored per operator.",
    },
    {
      id: "response-calibration",
      label: "Response calibration",
      status: "available",
      detail: `Saved response variation is applied to the ${provider} runtime on future turns.`,
    },
  ];
}
