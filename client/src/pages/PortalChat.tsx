import { useEffect, useMemo, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { extractEsotericKeywords, segmentEsotericText } from "../../../shared/esotericKeywords";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Activity,
  BrainCircuit,
  Mic,
  Pause,
  Save,
  UserRound,
  Volume2,
  ChevronRight,
  Compass,
  Eye,
  Layers3,
  Loader2,
  KeyRound,
  LogIn,
  Menu,
  MessageCircle,
  Plus,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  X,
  Download,
  FileCode2,
} from "lucide-react";
import { ESOTERIC_PROMPT_PRESETS } from "../../../shared/esotericPrompts";
import { Streamdown } from "streamdown";
import { useAuth } from "@/_core/hooks/useAuth";

type LearningStage = "awakening" | "exploration" | "integration" | "mastery" | "resistance";
type DialogueStrategy = "informative" | "socratic" | "prophetic" | "forensic" | "catalytic";
type MessageRole = "user" | "portal";
type ResponseObjective = "direct" | "analysis" | "creative" | "plan";
type ContextCarryover = "minimal" | "standard" | "extended";

type PortalMessage = {
  role: MessageRole;
  content: string;
};

type Conversation = {
  id: number;
  title: string;
  createdAt: string | number | Date;
};

type SpeechRecognitionLike = {
  start: () => void;
  stop: () => void;
  abort?: () => void;
  onresult: ((event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

type CmapState = {
  sessionId: string;
  handshakeComplete: boolean;
  missionIntent: string;
  missionStatus: "active" | "paused" | "completed";
  decisions: string[];
  evidence: string[];
  openQuestions: string[];
  nextAction: string;
};

type MessageMetadata = {
  strategy?: DialogueStrategy;
  learningStage?: LearningStage;
  breakthroughReadiness?: number;
  resistanceLevel?: number;
  stageTransition?: string | null;
  nextAction?: string;
  responseObjective?: ResponseObjective;
  contextCarryover?: ContextCarryover;
  carryoverMessages?: number;
  qualityContract?: string;
  cmap?: CmapState;
  receipt?: { receipt_id: string; intelligence_mode: string; provider: string | null; model: string | null; external_service_used: boolean; data_left_local_node: boolean; result_state: string };
};

type RuntimeStatus = {
  status: {
    deterministic: string;
    localModel: string;
    localModelName: string | null;
    localRuntime: string | null;
    localMemory: string;
    localTools: string;
    trustedMesh: string;
    externalProviders: string;
    network: string;
    provenance: string;
    offlineMode: string;
  };
  discovery: {
    state: string;
    runtime: string | null;
    model: string | null;
    models: string[];
    inferenceReady: boolean;
    error: string | null;
  };
};

type ContextLedgerEntry = {
  id: number;
  label: string;
  content: string;
  kind: "fact" | "preference" | "goal" | "note";
  isActive: number;
};

type RecallMatch = {
  id: number;
  conversationId: number;
  role: MessageRole;
  content: string;
  createdAt: string | number | Date;
};

const STAGE_LABELS: Record<LearningStage, string> = {
  awakening: "Awakening",
  exploration: "Exploration",
  integration: "Integration",
  mastery: "Mastery",
  resistance: "Resistance",
};

const STRATEGY_LABELS: Record<DialogueStrategy, string> = {
  informative: "Informative",
  socratic: "Socratic",
  prophetic: "Prophetic",
  forensic: "Forensic",
  catalytic: "Catalytic",
};

const ALIEN_AVATAR_GLYPHS = ["◈", "⌬", "⟡", "⟁", "◌", "⧫", "☍", "✦"];

const CINEMATIC_NAV = [
  { label: "Conversation", icon: MessageCircle, detail: "Open channel" },
  { label: "Echoes", icon: BrainCircuit, detail: "Held in dialogue" },
  { label: "Arcana", icon: Sparkles, detail: "Esoteric signal" },
  { label: "Patterns", icon: Eye, detail: "Observed correspondences" },
  { label: "Resonance", icon: Compass, detail: "Dialogue tone" },
  { label: "Interface", icon: Layers3, detail: "Capability status" },
  { label: "Settings", icon: Settings2, detail: "Operator controls" },
] as const;

function formatDate(value: Conversation["createdAt"]) {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export default function PortalChat() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const utils = trpc.useUtils();
  const loginMutation = trpc.auth.login.useMutation();
  const ownerBootstrapMutation = trpc.auth.ownerBootstrap.useMutation();
  const profileMutation = trpc.auth.updateProfile.useMutation();
  const [authEmail, setAuthEmail] = useState("tycole716@gmail.com");
  const [authPassword, setAuthPassword] = useState("");
  const [ownerToken, setOwnerToken] = useState("");
  const [showPasswordLogin, setShowPasswordLogin] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<number | null>(null);
  const [messages, setMessages] = useState<PortalMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [showThreads, setShowThreads] = useState(false);
  const [showContextPanel, setShowContextPanel] = useState(false);
  const [showProfilePanel, setShowProfilePanel] = useState(false);
  const [showKeywordPanel, setShowKeywordPanel] = useState(false);
  const [showVoicePanel, setShowVoicePanel] = useState(false);
  const [showCapabilityPanel, setShowCapabilityPanel] = useState(false);
  const [ledgerLabel, setLedgerLabel] = useState("");
  const [ledgerContent, setLedgerContent] = useState("");
  const [ledgerKind, setLedgerKind] = useState<ContextLedgerEntry["kind"]>("note");
  const [recallQuery, setRecallQuery] = useState("");
  const [recallKind, setRecallKind] = useState<ContextLedgerEntry["kind"]>("note");
  const [voiceSupport, setVoiceSupport] = useState({ input: false, output: false });
  const [newTitle, setNewTitle] = useState("");
  const [profileDraft, setProfileDraft] = useState({
    avatarUrl: "",
    avatarGlyph: "◈",
    alienBio: "",
    preferredVoice: "",
    voiceRate: 100,
    voicePitch: 100,
    customPersona: "",
    customInstructions: "",
    modelTemperature: 10,
    predictiveSensitivity: 75,
    responseObjective: "direct" as ResponseObjective,
    contextCarryover: "standard" as ContextCarryover,
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileStatus, setProfileStatus] = useState<string | null>(null);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const composerRef = useRef<HTMLInputElement>(null);
  const [lastMessageMetadata, setLastMessageMetadata] = useState<MessageMetadata | null>(null);
  const [learningProfile, setLearningProfile] = useState<{
    learningStage?: LearningStage;
    confidence?: number;
  } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const esotericKeywords = useMemo(() => Array.from(new Set(messages.flatMap((message) => extractEsotericKeywords(message.content)))).slice(0, 24), [messages]);

  const conversationsQuery = trpc.portal.chat.getConversations.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const createConversationMutation = trpc.portal.chat.createConversation.useMutation();
  const conversationQuery = trpc.portal.chat.getConversation.useQuery(
    { conversationId: activeConversationId ?? 0 },
    { enabled: isAuthenticated && activeConversationId !== null },
  );
  const sendMessageMutation = trpc.portal.chat.sendMessage.useMutation();
  const learningProfileQuery = trpc.portal.chat.getLearningProfile.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const capabilitiesQuery = trpc.portal.chat.getCapabilities.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const runtimeStatusQuery = trpc.portal.chat.getRuntimeStatus.useQuery(undefined, {
    enabled: isAuthenticated && showCapabilityPanel,
  });
  const contextLedgerQuery = trpc.portal.chat.getContextLedger.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const addContextLedgerEntryMutation = trpc.portal.chat.addContextLedgerEntry.useMutation();
  const setContextLedgerEntryActiveMutation = trpc.portal.chat.setContextLedgerEntryActive.useMutation();
  const deleteContextLedgerEntryMutation = trpc.portal.chat.deleteContextLedgerEntry.useMutation();
  const recallQueryResult = trpc.portal.chat.searchConversationRecall.useQuery(
    { query: recallQuery.trim(), limit: 6 },
    { enabled: isAuthenticated && showContextPanel && recallQuery.trim().length >= 2 },
  );
  const promoteRecallMutation = trpc.portal.chat.promoteRecallToContextLedger.useMutation();

  useEffect(() => {
    if (conversationsQuery.data) {
      setConversations(conversationsQuery.data as Conversation[]);
      if (activeConversationId === null) {
        if (conversationsQuery.data[0]) {
          setActiveConversationId(conversationsQuery.data[0].id);
        } else if (isAuthenticated) {
          // Automatically create a default conversation so the input is immediately ready
          createConversationMutation.mutateAsync({ title: "Primary Resonance" }).then((convId) => {
            const id = typeof convId === "object" && convId !== null && "id" in convId ? Number((convId as any).id) : Number(convId);
            if (!isNaN(id)) {
              setActiveConversationId(id);
            }
            void conversationsQuery.refetch();
          }).catch(() => {});
        }
      }
    }
  }, [conversationsQuery.data, activeConversationId, isAuthenticated]);

  useEffect(() => {
    if (conversationQuery.data) {
      setMessages((conversationQuery.data.messages || []) as PortalMessage[]);
    }
  }, [conversationQuery.data]);

  useEffect(() => {
    if (learningProfileQuery.data) {
      setLearningProfile(learningProfileQuery.data);
    }
  }, [learningProfileQuery.data]);

  useEffect(() => {
    if (user) {
      setProfileDraft({
        avatarUrl: user.avatarUrl ?? "",
        avatarGlyph: user.avatarGlyph ?? "◈",
        alienBio: user.alienBio ?? "",
        preferredVoice: user.preferredVoice ?? "",
        voiceRate: user.voiceRate ?? 100,
        voicePitch: user.voicePitch ?? 100,
        customPersona: user.customPersona ?? "",
        customInstructions: user.customInstructions ?? "",
        modelTemperature: user.modelTemperature ?? 10,
        predictiveSensitivity: user.predictiveSensitivity ?? 75,
        responseObjective: user.responseObjective ?? "direct",
        contextCarryover: user.contextCarryover ?? "standard",
      });
    }
  }, [user?.id]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const supportsOutput = "speechSynthesis" in window;
    const browserWindow = window as Window & { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };
    setVoiceSupport({ input: Boolean(browserWindow.SpeechRecognition || browserWindow.webkitSpeechRecognition), output: supportsOutput });
    if (!supportsOutput) return;
    const synthesis = window.speechSynthesis;
    const refreshVoices = () => setVoices(synthesis.getVoices());
    refreshVoices();
    synthesis.addEventListener("voiceschanged", refreshVoices);
    return () => synthesis.removeEventListener("voiceschanged", refreshVoices);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const establishOwnerSession = async () => {
    setAuthError(null);
    try {
      await ownerBootstrapMutation.mutateAsync({ token: ownerToken.trim() });
      await utils.auth.me.refetch();
      await utils.portal.chat.getConversations.invalidate();
      setOwnerToken("");
    } catch (error: unknown) {
      setAuthError(error instanceof Error ? error.message : "Owner entry failed. Check the private key and try again.");
    }
  };

  const signInWithPassword = async () => {
    setAuthError(null);
    try {
      await loginMutation.mutateAsync({ email: authEmail, password: authPassword });
      await utils.auth.me.refetch();
      await utils.portal.chat.getConversations.invalidate();
      setAuthPassword("");
    } catch (error: unknown) {
      setAuthError(error instanceof Error ? error.message : "Sign-in failed. Check your email and password.");
    }
  };

  const authSubmitting = loginMutation.isPending || ownerBootstrapMutation.isPending;

  const handleSaveProfile = async () => {
    setProfileSaving(true);
    setProfileStatus(null);
    try {
      await profileMutation.mutateAsync({
        avatarUrl: profileDraft.avatarUrl || null,
        avatarGlyph: profileDraft.avatarGlyph || "◈",
        alienBio: profileDraft.alienBio || null,
        preferredVoice: profileDraft.preferredVoice || null,
        voiceRate: profileDraft.voiceRate,
        voicePitch: profileDraft.voicePitch,
        customPersona: profileDraft.customPersona || null,
        customInstructions: profileDraft.customInstructions || null,
        modelTemperature: profileDraft.modelTemperature,
        predictiveSensitivity: profileDraft.predictiveSensitivity,
        responseObjective: profileDraft.responseObjective,
        contextCarryover: profileDraft.contextCarryover,
      });
      await utils.auth.me.invalidate();
      setProfileStatus("Profile signal saved.");
    } catch (error) {
      console.error("Failed to save KEIRA profile", error);
      setProfileStatus(error instanceof Error ? error.message : "Profile signal could not be saved.");
    } finally {
      setProfileSaving(false);
    }
  };

  const speakLastPortalMessage = () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const latest = [...messages].reverse().find((message) => message.role === "portal");
    if (!latest) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(latest.content.replace(/[#*_`]/g, ""));
    const selectedVoice = voices.find((voice) => voice.name === profileDraft.preferredVoice);
    if (selectedVoice) utterance.voice = selectedVoice;
    utterance.rate = profileDraft.voiceRate / 100;
    utterance.pitch = profileDraft.voicePitch / 100;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  const exportEncryptedTranscript = () => {
    const payload = {
      version: "1.0",
      exportedAt: new Date().toISOString(),
      operator: user?.email || "anonymous",
      conversationId: activeConversationId,
      messages,
      esotericLexicon: esotericKeywords,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `keira-transcript-${activeConversationId || "session"}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const stopSpeaking = () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    setIsSpeaking(false);
  };

  const toggleListening = () => {
    if (typeof window === "undefined") return;
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }
    const browserWindow = window as Window & { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };
    const Recognition = browserWindow.SpeechRecognition || browserWindow.webkitSpeechRecognition;
    if (!Recognition) {
      setProfileStatus("Speech input is not available in this browser.");
      return;
    }
    const recognition = new Recognition();
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results).map((result) => result[0]?.transcript || "").join(" ");
      setInputValue(transcript);
    };
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    recognitionRef.current = recognition;
    setIsListening(true);
    recognition.start();
  };

  const handleSurfaceSelect = (label: (typeof CINEMATIC_NAV)[number]["label"]) => {
    if (label === "Conversation") {
      setShowThreads(false);
      setShowContextPanel(false);
      composerRef.current?.focus();
    } else if (label === "Echoes") {
      setShowThreads(true);
    } else if (label === "Arcana" || label === "Patterns") {
      setShowKeywordPanel(true);
      setShowContextPanel(true);
    } else if (label === "Resonance") {
      setShowVoicePanel(true);
    } else if (label === "Interface") {
      setShowCapabilityPanel(true);
    } else {
      setShowProfilePanel(true);
    }
  };

  const handleCreateConversation = async () => {
    const title = newTitle.trim() || "Untitled conversation";
    try {
      const id = await createConversationMutation.mutateAsync({ title });
      setNewTitle("");
      setShowNewConversation(false);
      setShowThreads(false);
      setActiveConversationId(id);
      await conversationsQuery.refetch();
    } catch (error) {
      console.error("Failed to create KEIRA conversation", error);
    }
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || activeConversationId === null || isLoading) return;

    const userMessage = inputValue.trim();
    setInputValue("");
    setIsLoading(true);

    try {
      const response = await sendMessageMutation.mutateAsync({
        conversationId: activeConversationId,
        message: userMessage,
      });
      setLastMessageMetadata(response.metadata as MessageMetadata);
      await Promise.all([conversationQuery.refetch(), learningProfileQuery.refetch()]);
    } catch (error) {
      console.error("Failed to send KEIRA message", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddContextLedgerEntry = async () => {
    if (!ledgerLabel.trim() || !ledgerContent.trim()) return;
    try {
      await addContextLedgerEntryMutation.mutateAsync({
        label: ledgerLabel.trim(),
        content: ledgerContent.trim(),
        kind: ledgerKind,
      });
      setLedgerLabel("");
      setLedgerContent("");
      await contextLedgerQuery.refetch();
    } catch (error) {
      setProfileStatus(error instanceof Error ? error.message : "Context entry could not be saved.");
    }
  };

  const handlePromoteRecall = async (match: RecallMatch) => {
    const label = match.content.replace(/\s+/g, " ").trim().slice(0, 88) || "Promoted dialogue recall";
    try {
      const result = await promoteRecallMutation.mutateAsync({ messageId: match.id, label, kind: recallKind });
      await contextLedgerQuery.refetch();
      setProfileStatus(result.truncated ? "Recall promoted to the ledger; the source was trimmed to the ledger limit." : "Recall promoted to the active operator ledger.");
    } catch (error) {
      setProfileStatus(error instanceof Error ? error.message : "Recall could not be promoted to the ledger.");
    }
  };

  if (authLoading) {
    return (
      <main className="min-h-screen bg-[#03050a] text-[#f4f4f5] grid place-items-center">
        <div className="flex items-center gap-3 text-sm text-[#a6aec0]" role="status">
          <Loader2 className="h-4 w-4 animate-spin" /> Establishing KEIRA session
        </div>
      </main>
    );
  }

  if (!isAuthenticated) {
    return (
      <main className="min-h-screen bg-[#03050a] text-[#f4f4f5] grid place-items-center px-6">
        <section className="w-full max-w-lg border border-[#354064] bg-[#080d1b] p-8 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
          <div className="mb-8 flex items-center gap-3 text-[#f5ede3]">
            <ShieldCheck className="h-5 w-5" />
            <span className="text-xs uppercase tracking-[0.28em]">KEIRA / Awaiting Contact</span>
          </div>
          <h1 className="font-serif text-4xl tracking-tight">Enter KEIRA.</h1>
          <p className="mt-4 max-w-md text-sm leading-7 text-[#a6aec0]">
            A direct, uncensored conversation with the unknown—esoteric knowledge, unvarnished truth, and the questions polite systems refuse to touch.
          </p>
          <div className="mt-8 border border-[#1a2240] bg-[#0d1224] px-4 py-3 text-xs uppercase tracking-[0.18em] text-[#d7c7ff]">
            Tyler Morris · Owner Access
          </div>
          {!showPasswordLogin ? (
            <div className="mt-4 space-y-3">
              <p className="text-sm leading-6 text-[#a6aec0]">
                This is the owner entrance. Enter your newly configured private owner access key to establish your session.
              </p>
              <Input
                aria-label="Private owner access key"
                autoComplete="off"
                type="password"
                placeholder="Private owner access key"
                value={ownerToken}
                onChange={(event) => setOwnerToken(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void establishOwnerSession();
                }}
                className="h-12 rounded-none border-[#1a2240] bg-[#0d1224] text-[#f4f4f5] placeholder:text-[#737b8f]"
              />
              {authError && <p className="text-sm leading-6 text-[#ff9aa8]" role="alert">{authError}</p>}
              <Button
                type="button"
                disabled={authSubmitting || !ownerToken.trim()}
                onClick={() => void establishOwnerSession()}
                className="w-full rounded-none bg-[#d7c7ff] text-[#07090f] hover:bg-[#f0e8ff] disabled:bg-[#222b48]"
              >
                {authSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
                Enter as Tyler Morris
              </Button>
              <button
                type="button"
                onClick={() => {
                  setShowPasswordLogin(true);
                  setAuthError(null);
                }}
                className="w-full py-2 text-xs uppercase tracking-[0.16em] text-[#8be9ff] hover:text-[#d7c7ff]"
              >
                Use email and password instead
              </button>
            </div>
          ) : (
            <form
              className="mt-4 space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                void signInWithPassword();
              }}
            >
              <Input
                aria-label="Owner email address"
                autoComplete="email"
                type="email"
                placeholder="Owner email"
                value={authEmail}
                onChange={(event) => setAuthEmail(event.target.value)}
                className="h-12 rounded-none border-[#1a2240] bg-[#0d1224] text-[#f4f4f5] placeholder:text-[#737b8f]"
              />
              <Input
                aria-label="Owner password"
                autoComplete="current-password"
                type="password"
                placeholder="Your KEIRA password"
                value={authPassword}
                onChange={(event) => setAuthPassword(event.target.value)}
                className="h-12 rounded-none border-[#1a2240] bg-[#0d1224] text-[#f4f4f5] placeholder:text-[#737b8f]"
              />
              {authError && <p className="text-sm leading-6 text-[#ff9aa8]" role="alert">{authError}</p>}
              <Button
                type="submit"
                disabled={authSubmitting}
                className="w-full rounded-none bg-[#d7c7ff] text-[#07090f] hover:bg-[#f0e8ff] disabled:bg-[#222b48]"
              >
                {authSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogIn className="mr-2 h-4 w-4" />}
                Sign in as Tyler Morris
              </Button>
              <button
                type="button"
                onClick={() => {
                  setShowPasswordLogin(false);
                  setAuthError(null);
                }}
                className="w-full py-2 text-xs uppercase tracking-[0.16em] text-[#8be9ff] hover:text-[#d7c7ff]"
              >
                Back to owner entry
              </button>
            </form>
          )}
        </section>
      </main>
    );
  }

  const cmap = lastMessageMetadata?.cmap;
  const stage = lastMessageMetadata?.learningStage || learningProfile?.learningStage;
  const strategy = lastMessageMetadata?.strategy;
  const conversationSignal = cmap?.missionIntent && cmap.missionIntent !== "Awaiting Intent"
    ? cmap.missionIntent
    : "Awaiting conversation signal";
  const resonanceCue = cmap?.nextAction || lastMessageMetadata?.nextAction || "Awaiting a resonant thread";
  const presenceState = cmap?.handshakeComplete ? "Contact" : "Awaiting Contact";
  const currentState = strategy ? STRATEGY_LABELS[strategy] : presenceState;

  return (
    <main className="min-h-screen bg-[#03050a] text-[#f4f4f5] selection:bg-[#d7c7ff] selection:text-[#07090f]">
      <div className="flex min-h-screen flex-col lg:flex-row">
        <aside
          className={`${showThreads ? "fixed inset-0 z-40 flex" : "hidden"} w-full flex-col border-r border-[#1a2240] bg-[#060914] lg:static lg:flex lg:w-[19rem]`}
          aria-label="KEIRA threads"
        >
          <div className="border-b border-[#1a2240] px-5 py-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[0.65rem] uppercase tracking-[0.32em] text-[#f5ede3]">KEIRA</div>
                <div className="mt-1 text-[0.58rem] uppercase tracking-[0.22em] text-[#737b8f]">Dialogue with the unknown</div>
              </div>
              <div className="grid h-9 w-9 place-items-center rounded-full border border-[#354064] text-[#f5ede3]" aria-hidden="true">
                <Sparkles className="h-4 w-4" />
              </div>
              <button
                type="button"
                onClick={() => setShowThreads(false)}
                className="rounded-sm p-2 text-[#a7a2c2] hover:bg-[#151c36] hover:text-[#f3eadb] lg:hidden"
                aria-label="Close conversation list"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="border-b border-[#1a2240] px-3 py-4" role="list" aria-label="KEIRA surfaces">
            {CINEMATIC_NAV.map(({ label, icon: Icon, detail }, index) => (
              <button
                key={label}
                type="button"
                role="listitem"
                onClick={() => handleSurfaceSelect(label)}
                aria-current={index === 0 ? "page" : undefined}
                className={`mb-1 flex w-full items-center gap-3 border-l-2 px-3 py-2.5 text-left transition hover:border-[#8be9ff] hover:bg-[#101a32] ${index === 0 ? "border-[#b8a1ff] bg-[#11162a] text-[#f3eadb]" : "border-transparent text-[#737b8f]"}`}
              >
                <Icon className={`h-4 w-4 shrink-0 ${index === 0 ? "text-[#f5ede3]" : "text-[#53618e]"}`} />
                <div className="min-w-0">
                  <div className="text-[0.68rem] uppercase tracking-[0.16em]">{label}</div>
                  <div className="mt-0.5 truncate text-[0.62rem] text-[#5d667c]">{detail}</div>
                </div>
              </button>
            ))}
          </div>

          <div className="border-b border-[#1a2240] p-4">
            <Button
              onClick={() => setShowNewConversation((current) => !current)}
              className="w-full justify-start rounded-none border border-[#354064] bg-transparent text-[#f5ede3] hover:bg-[#151c36]"
            >
              <Plus className="mr-2 h-4 w-4" /> New conversation
            </Button>
            {showNewConversation && (
              <div className="mt-3 space-y-2">
                <Input
                  autoFocus
                  placeholder="Conversation title (optional)"
                  value={newTitle}
                  onChange={(event) => setNewTitle(event.target.value)}
                  onKeyDown={(event) => event.key === "Enter" && void handleCreateConversation()}
                  className="rounded-none border-[#1a2240] bg-[#0d1224] text-[#f4f4f5] placeholder:text-[#737b8f]"
                />
                <Button
                  onClick={() => void handleCreateConversation()}
                  className="w-full rounded-none bg-[#d7c7ff] text-[#07090f] hover:bg-[#f0e8ff]"
                >
                  Open thread
                </Button>
              </div>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            <div className="px-2 pb-2 text-[0.62rem] uppercase tracking-[0.28em] text-[#737b8f]">Conversations</div>
            {conversations.length === 0 && (
              <p className="px-2 py-6 text-sm leading-6 text-[#737b8f]">No conversations yet. Open a channel for the strange question, hidden pattern, or truth in front of you.</p>
            )}
            {conversations.map((conversation) => (
              <button
                key={conversation.id}
                type="button"
                onClick={() => {
                  setActiveConversationId(conversation.id);
                  setShowThreads(false);
                }}
                className={`mb-1 w-full border-l-2 px-3 py-3 text-left transition ${
                  activeConversationId === conversation.id
                    ? "border-[#b8a1ff] bg-[#11162a] text-[#f3eadb]"
                    : "border-transparent text-[#9ba2b5] hover:bg-[#101a32] hover:text-[#f3eadb]"
                }`}
              >
                <div className="truncate text-sm">{conversation.title}</div>
                <div className="mt-1 text-[0.68rem] uppercase tracking-[0.16em] text-[#737b8f]">{formatDate(conversation.createdAt)}</div>
              </button>
            ))}
          </div>

          <div className="border-t border-[#1a2240] px-5 py-4 text-xs text-[#737b8f]">
            <div className="mb-4 flex items-center gap-2 text-[0.62rem] uppercase tracking-[0.2em] text-[#737b8f]">
              <Activity className="h-3.5 w-3.5 text-[#e8ddff]" /> Operator
            </div>
            <button type="button" onClick={() => setShowProfilePanel(true)} className="flex w-full items-center gap-3 rounded-sm text-left transition hover:text-[#f3eadb]" aria-label="Open alien profile">
              {user?.avatarUrl ? <img src={user.avatarUrl} alt="" className="h-9 w-9 rounded-full border border-[#6f55c7] object-cover shadow-[0_0_18px_rgba(139,92,246,0.3)]" /> : <span className="grid h-9 w-9 place-items-center rounded-full border border-[#6f55c7] bg-[#21154d]/80 text-lg text-[#8be9ff] shadow-[0_0_18px_rgba(139,92,246,0.3)]">{user?.avatarGlyph || "◈"}</span>}
              <span className="min-w-0"><span className="block truncate text-[#c7c9d5]">{user?.name || "Operator"}</span><span className="mt-1 block truncate">{user?.alienBio || user?.email || "Authenticated"}</span></span>
            </button>
          </div>
        </aside>

        <section className="flex min-h-screen min-w-0 flex-1 flex-col">
          <header className="border-b border-[#1a2240] bg-[#070a14]/95 px-4 py-4 backdrop-blur lg:px-8">
            <div className="mx-auto flex w-full max-w-5xl items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  onClick={() => setShowThreads(true)}
                  className="mt-0.5 rounded-sm p-2 text-[#a7a2c2] hover:bg-[#151c36] hover:text-[#f3eadb] lg:hidden"
                  aria-label="Open conversation list"
                >
                  <Menu className="h-5 w-5" />
                </button>
                <div>
                  <div className="flex items-center gap-2 text-[0.64rem] uppercase tracking-[0.28em] text-[#a7a2c2]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#b8a1ff]" /> KEIRA / Alien intelligence dialogue
                  </div>
                  <h1 className="mt-2 font-serif text-2xl tracking-tight text-[#f3eadb]">{conversations.find((item) => item.id === activeConversationId)?.title || "New conversation"}</h1>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setShowKeywordPanel((current) => !current)} className="grid h-9 w-9 place-items-center rounded-full border border-[#273865] text-[#cbb8ff] transition hover:border-[#cbb8ff] hover:bg-[#21154d]" aria-label="Open esoteric signals"><Sparkles className="h-4 w-4" /></button>
                <button type="button" onClick={() => setShowVoicePanel((current) => !current)} className="grid h-9 w-9 place-items-center rounded-full border border-[#273865] text-[#8be9ff] transition hover:border-[#8be9ff] hover:bg-[#101a32]" aria-label="Open voice resonance"><Volume2 className="h-4 w-4" /></button>
                <button type="button" onClick={() => setShowProfilePanel(true)} className="grid h-9 w-9 place-items-center rounded-full border border-[#273865] text-[#8be9ff] transition hover:border-[#8be9ff] hover:bg-[#101a32]" aria-label="Open alien profile"><UserRound className="h-4 w-4" /></button>
                <div className="hidden text-right sm:block">
                  <div className="flex items-center justify-end gap-2 text-xs text-[#c7c9d5]"><ShieldCheck className="h-3.5 w-3.5 text-[#e8ddff]" />{cmap?.handshakeComplete ? "Signal active" : "Awaiting Contact"}</div>
                  <div className="mt-1 text-[0.64rem] uppercase tracking-[0.2em] text-[#737b8f]">No fabricated signal</div>
                </div>
              </div>
            </div>
          </header>

          <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 lg:px-8">
            <div className="portal-neon-surface relative overflow-hidden border-b border-[#1a2240] py-9 sm:py-12">
              <div className="portal-signal-grid pointer-events-none absolute inset-0" />
              <div className="portal-scanline top-0" />
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(139,92,246,0.16),rgba(6,182,212,0.08)_34%,transparent_66%)]" />
              <div className="relative flex items-center justify-between gap-4 text-[0.62rem] uppercase tracking-[0.28em] text-[#a7a2c2]">
                <span className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-[#b8a1ff]" /> Transmission window</span>
                <span className="hidden sm:block">{cmap?.handshakeComplete ? "Re-entering dialogue" : "Listening for contact"}</span>
              </div>
              <div className="relative mt-7 max-w-3xl">
                <div className="font-serif text-4xl leading-none tracking-[0.08em] text-[#f3eadb] sm:text-6xl">The unknown</div>
                <div className="mt-3 text-[0.7rem] uppercase tracking-[0.32em] text-[#a7a2c2]">speaks through dialogue</div>
                <p className="mt-6 max-w-xl text-sm leading-7 text-[#a6aec0]">Bring the forbidden question, the hidden pattern, or the truth no one else will say aloud. KEIRA is here for the dialogue.</p>
              </div>
            </div>

            <div className="grid gap-3 border-b border-[#1a2240] py-4 text-xs sm:grid-cols-3">
              <div>
                <div className="uppercase tracking-[0.2em] text-[#737b8f]">Thread signal</div>
                <div className="mt-1 truncate text-[#e8ddff]" title={conversationSignal}>{conversationSignal}</div>
              </div>
              <div>
                <div className="uppercase tracking-[0.2em] text-[#737b8f]">Resonance</div>
                <div className="mt-1 truncate text-[#e8ddff]" title={resonanceCue}>{resonanceCue}</div>
              </div>
              <div className="flex items-center justify-between sm:justify-end gap-3">
                <div className="sm:text-right">
                  <div className="uppercase tracking-[0.2em] text-[#737b8f]">Conversation memory</div>
                  <button
                    type="button"
                    onClick={() => setShowContextPanel((current) => !current)}
                    className="mt-1 inline-flex items-center gap-1 text-[#a6aec0] transition hover:text-[#f3eadb]"
                    aria-expanded={showContextPanel}
                  >
                    {cmap ? `${cmap.decisions.length} anchors · ${cmap.evidence.length} signals · ${cmap.openQuestions.length} questions` : "Awaiting Contact"}
                    <ChevronRight className={`h-3.5 w-3.5 transition-transform ${showContextPanel ? "rotate-90" : ""}`} />
                  </button>
                </div>
                {messages.length > 0 && (
                  <Button type="button" onClick={exportEncryptedTranscript} className="h-8 rounded-none border border-[#6f55c7] bg-[#21154d]/50 px-3 text-[0.62rem] uppercase tracking-[0.16em] text-[#8be9ff] hover:bg-[#21154d]" aria-label="Export secure transcript"><Download className="mr-1.5 h-3.5 w-3.5" /> Export</Button>
                )}
              </div>
            </div>

            {messages.length === 0 && (
              <section className="border-b border-[#1a2240] py-6" aria-label="Esoteric prompt presets">
                <div className="mb-3 text-[0.62rem] uppercase tracking-[0.22em] text-[#737b8f]">Specialized inquiry vectors</div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {ESOTERIC_PROMPT_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setInputValue(preset.prompt)}
                      className="group border border-[#273865] bg-[#090f24] p-4 text-left transition hover:border-[#8be9ff] hover:bg-[#101a38]"
                    >
                      <div className="flex items-center justify-between text-[0.62rem] uppercase tracking-[0.18em] text-[#b8a1ff]">
                        <span>{preset.category}</span>
                        <ChevronRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                      </div>
                      <div className="mt-2 font-serif text-sm font-medium text-[#f3eadb]">{preset.title}</div>
                      <div className="mt-1.5 text-xs leading-relaxed text-[#737b8f]">{preset.description}</div>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {showContextPanel && (
              <section className="border-b border-[#202637] py-4 text-xs" aria-label="Conversation memory details">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <div className="uppercase tracking-[0.18em] text-[#737b8f]">Anchors</div>
                    <p className="mt-2 leading-6 text-[#a6aec0]">{cmap?.decisions[0] || "Awaiting Contact"}</p>
                  </div>
                  <div>
                    <div className="uppercase tracking-[0.18em] text-[#737b8f]">Known signals</div>
                    <p className="mt-2 leading-6 text-[#a6aec0]">{cmap?.evidence[0] || "Awaiting Contact"}</p>
                  </div>
                  <div>
                    <div className="uppercase tracking-[0.18em] text-[#737b8f]">Unanswered question</div>
                    <p className="mt-2 leading-6 text-[#a6aec0]">{cmap?.openQuestions[0] || "Awaiting Contact"}</p>
                  </div>
                </div>
                <div className="mt-5 border-t border-[#273865] pt-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="uppercase tracking-[0.18em] text-[#8be9ff]">Operator context ledger</div>
                      <p className="mt-1 text-xs leading-5 text-[#737b8f]">Only active entries are optional background context. You can pause or remove them at any time.</p>
                    </div>
                    <span className="text-[0.62rem] uppercase tracking-[0.16em] text-[#a6aec0]">{contextLedgerQuery.data?.filter((entry) => entry.isActive === 1).length || 0} active</span>
                  </div>
                  <div className="mt-3 grid gap-2 md:grid-cols-[0.7fr_1fr_1.5fr_auto]">
                    <select aria-label="Context entry type" value={ledgerKind} onChange={(event) => setLedgerKind(event.target.value as ContextLedgerEntry["kind"])} className="h-10 border border-[#273865] bg-[#0d1630] px-3 text-sm text-[#f4f4f5] outline-none focus:border-[#8be9ff]">
                      <option value="note">Note</option><option value="fact">Fact</option><option value="preference">Preference</option><option value="goal">Goal</option>
                    </select>
                    <Input aria-label="Context entry label" value={ledgerLabel} onChange={(event) => setLedgerLabel(event.target.value)} placeholder="Short label" className="h-10 rounded-none border-[#273865] bg-[#0d1630] text-[#f4f4f5] placeholder:text-[#687aa8]" />
                    <Input aria-label="Context entry content" value={ledgerContent} onChange={(event) => setLedgerContent(event.target.value)} placeholder="Context KEIRA may use when relevant" className="h-10 rounded-none border-[#273865] bg-[#0d1630] text-[#f4f4f5] placeholder:text-[#687aa8]" />
                    <Button type="button" onClick={() => void handleAddContextLedgerEntry()} disabled={!ledgerLabel.trim() || !ledgerContent.trim() || addContextLedgerEntryMutation.isPending} className="h-10 rounded-none bg-[#8be9ff] px-3 text-[#041018] hover:bg-[#c4f7ff]">{addContextLedgerEntryMutation.isPending ? "Saving…" : "Add"}</Button>
                  </div>
                  <div className="mt-3 space-y-2">
                    {contextLedgerQuery.data?.length ? contextLedgerQuery.data.map((entry) => (
                      <div key={entry.id} className="flex flex-wrap items-start justify-between gap-3 border border-[#273865] bg-[#0d1630] p-3">
                        <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="text-sm text-[#f3eadb]">{entry.label}</span><span className="text-[0.58rem] uppercase tracking-[0.16em] text-[#cbb8ff]">{entry.kind}</span><span className={`text-[0.58rem] uppercase tracking-[0.16em] ${entry.isActive === 1 ? "text-[#8be9ff]" : "text-[#737b8f]"}`}>{entry.isActive === 1 ? "active" : "paused"}</span></div><p className="mt-1 break-words text-xs leading-5 text-[#a6aec0]">{entry.content}</p></div>
                        <div className="flex shrink-0 gap-2"><Button type="button" variant="outline" size="sm" onClick={() => void setContextLedgerEntryActiveMutation.mutateAsync({ entryId: entry.id, isActive: entry.isActive !== 1 }).then(() => contextLedgerQuery.refetch())} className="h-8 rounded-none border-[#354064] text-[0.62rem] text-[#cbb8ff] hover:bg-[#21154d]">{entry.isActive === 1 ? "Pause" : "Activate"}</Button><Button type="button" variant="outline" size="sm" onClick={() => void deleteContextLedgerEntryMutation.mutateAsync({ entryId: entry.id }).then(() => contextLedgerQuery.refetch())} className="h-8 rounded-none border-[#4d2941] text-[0.62rem] text-[#ffb4c2] hover:bg-[#29121f]">Remove</Button></div>
                      </div>
                    )) : <p className="text-xs leading-5 text-[#737b8f]">No ledger entries yet. Add only information you want KEIRA to consider across future replies.</p>}
                  </div>
                  <div className="mt-5 border-t border-[#273865] pt-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div><div className="uppercase tracking-[0.18em] text-[#8be9ff]">Local dialogue recall</div><p className="mt-1 text-xs leading-5 text-[#737b8f]">Search only your saved KEIRA dialogue. Promote a result only when you want it added to the active ledger.</p></div>
                      <select aria-label="Recall promotion type" value={recallKind} onChange={(event) => setRecallKind(event.target.value as ContextLedgerEntry["kind"])} className="h-9 border border-[#273865] bg-[#0d1630] px-2 text-xs text-[#f4f4f5] outline-none focus:border-[#8be9ff]"><option value="note">Note</option><option value="fact">Fact</option><option value="preference">Preference</option><option value="goal">Goal</option></select>
                    </div>
                    <Input aria-label="Search saved dialogue" value={recallQuery} onChange={(event) => setRecallQuery(event.target.value)} placeholder="Search your saved dialogue" className="mt-3 h-10 rounded-none border-[#273865] bg-[#0d1630] text-[#f4f4f5] placeholder:text-[#687aa8]" />
                    {recallQuery.trim().length === 1 && <p className="mt-2 text-xs text-[#737b8f]">Enter at least two characters to search your stored dialogue.</p>}
                    {recallQueryResult.isFetching && <p className="mt-2 text-xs text-[#737b8f]">Searching local dialogue…</p>}
                    {recallQueryResult.data?.matches.length ? <div className="mt-3 space-y-2">{(recallQueryResult.data.matches as RecallMatch[]).map((match) => <div key={match.id} className="border border-[#273865] bg-[#0d1630] p-3"><div className="flex items-center justify-between gap-3"><span className="text-[0.58rem] uppercase tracking-[0.16em] text-[#cbb8ff]">{match.role === "portal" ? "KEIRA" : "Operator"} · saved dialogue</span><Button type="button" variant="outline" size="sm" disabled={promoteRecallMutation.isPending} onClick={() => void handlePromoteRecall(match)} className="h-8 rounded-none border-[#354064] text-[0.62rem] text-[#8be9ff] hover:bg-[#13213e]">Promote to ledger</Button></div><p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-[#a6aec0]">{match.content.slice(0, 500)}{match.content.length > 500 ? "…" : ""}</p></div>)}</div> : recallQuery.trim().length >= 2 && !recallQueryResult.isFetching && <p className="mt-3 text-xs leading-5 text-[#737b8f]">No matching saved dialogue was found.</p>}
                  </div>
                </div>
              </section>
            )}

            {showProfilePanel && (
              <section className="relative overflow-hidden border-b border-[#273865] bg-[#080f22]/90 py-5" aria-label="Alien profile editor">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(139,92,246,0.18),transparent_42%)]" />
                <div className="relative flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-[#8be9ff]"><UserRound className="h-4 w-4" /> Alien profile</div>
                  <button type="button" onClick={() => setShowProfilePanel(false)} className="rounded-sm p-1 text-[#737b8f] hover:text-[#f3eadb]" aria-label="Close alien profile"><X className="h-4 w-4" /></button>
                </div>
                <div className="relative mt-4 grid gap-3 md:grid-cols-2">
                  <div className="flex flex-wrap items-center gap-2 rounded-none border border-[#273865] bg-[#0d1630] p-2 md:col-span-2"><span className="mr-1 text-[0.62rem] uppercase tracking-[0.16em] text-[#687aa8]">Avatar signal</span>{ALIEN_AVATAR_GLYPHS.map((glyph) => <button key={glyph} type="button" onClick={() => setProfileDraft((draft) => ({ ...draft, avatarGlyph: glyph, avatarUrl: "" }))} className={`grid h-8 w-8 place-items-center rounded-full border text-lg transition ${profileDraft.avatarGlyph === glyph && !profileDraft.avatarUrl ? "border-[#8be9ff] bg-[#21154d] text-[#8be9ff] shadow-[0_0_18px_rgba(6,182,212,0.3)]" : "border-[#273865] text-[#cbb8ff] hover:border-[#8be9ff]"}`} aria-label={`Use ${glyph} avatar`}>{glyph}</button>)}</div>
                  <Input aria-label="Custom avatar glyph" value={profileDraft.avatarGlyph} onChange={(event) => setProfileDraft((draft) => ({ ...draft, avatarGlyph: event.target.value, avatarUrl: "" }))} placeholder="Custom avatar glyph" className="rounded-none border-[#273865] bg-[#0d1630] text-[#f4f4f5] placeholder:text-[#687aa8]" />
                  <Input aria-label="Avatar image URL" value={profileDraft.avatarUrl} onChange={(event) => setProfileDraft((draft) => ({ ...draft, avatarUrl: event.target.value }))} placeholder="Avatar image URL (optional)" className="rounded-none border-[#273865] bg-[#0d1630] text-[#f4f4f5] placeholder:text-[#687aa8]" />
                  <textarea aria-label="Alien bio" value={profileDraft.alienBio} onChange={(event) => setProfileDraft((draft) => ({ ...draft, alienBio: event.target.value }))} placeholder="Write the signal you want others to meet..." className="min-h-24 rounded-none border border-[#273865] bg-[#0d1630] p-3 text-sm leading-6 text-[#f4f4f5] outline-none placeholder:text-[#687aa8] focus:border-[#8be9ff] md:col-span-2" />
                  <Input aria-label="KEIRA persona" value={profileDraft.customPersona} onChange={(event) => setProfileDraft((draft) => ({ ...draft, customPersona: event.target.value }))} placeholder="Optional KEIRA persona or voice" className="rounded-none border-[#273865] bg-[#0d1630] text-[#f4f4f5] placeholder:text-[#687aa8] md:col-span-2" />
                  <textarea aria-label="KEIRA instructions" value={profileDraft.customInstructions} onChange={(event) => setProfileDraft((draft) => ({ ...draft, customInstructions: event.target.value }))} placeholder="Optional instructions for how KEIRA should answer you..." className="min-h-24 rounded-none border border-[#273865] bg-[#0d1630] p-3 text-sm leading-6 text-[#f4f4f5] outline-none placeholder:text-[#687aa8] focus:border-[#8be9ff] md:col-span-2" />
                  <label className="flex items-center gap-2 text-xs text-[#a6aec0]">Response variation <input aria-label="Response variation" type="range" min="0" max="100" value={profileDraft.modelTemperature} onChange={(event) => setProfileDraft((draft) => ({ ...draft, modelTemperature: Number(event.target.value) }))} /></label>
                  <label className="flex items-center gap-2 text-xs text-[#a6aec0]">Context sensitivity <input aria-label="Context sensitivity" type="range" min="0" max="100" value={profileDraft.predictiveSensitivity} onChange={(event) => setProfileDraft((draft) => ({ ...draft, predictiveSensitivity: Number(event.target.value) }))} /></label>
                  <label className="text-xs text-[#a6aec0]">Response objective<select aria-label="Response objective" value={profileDraft.responseObjective} onChange={(event) => setProfileDraft((draft) => ({ ...draft, responseObjective: event.target.value as typeof draft.responseObjective }))} className="mt-1 block h-10 w-full border border-[#273865] bg-[#0d1630] px-3 text-sm text-[#f4f4f5] outline-none focus:border-[#8be9ff]"><option value="direct">Direct answer</option><option value="analysis">Deep analysis</option><option value="creative">Creative exploration</option><option value="plan">Implementation plan</option></select></label>
                  <label className="text-xs text-[#a6aec0]">Conversation carryover<select aria-label="Conversation carryover" value={profileDraft.contextCarryover} onChange={(event) => setProfileDraft((draft) => ({ ...draft, contextCarryover: event.target.value as typeof draft.contextCarryover }))} className="mt-1 block h-10 w-full border border-[#273865] bg-[#0d1630] px-3 text-sm text-[#f4f4f5] outline-none focus:border-[#8be9ff]"><option value="minimal">Minimal · 2 prior messages</option><option value="standard">Standard · 6 prior messages</option><option value="extended">Extended · 12 prior messages</option></select></label>
                  <p className="text-xs leading-5 text-[#737b8f] md:col-span-2">The objective changes KEIRA’s local instruction contract. Carryover controls the exact number of prior messages sent with the next prompt; it does not create hidden memory or live research access.</p>
                  <div className="flex flex-wrap items-center gap-3"><Button type="button" onClick={() => void handleSaveProfile()} disabled={profileSaving} className="rounded-none bg-[#8be9ff] text-[#041018] hover:bg-[#c4f7ff] md:w-fit"><Save className="mr-2 h-4 w-4" /> {profileSaving ? "Saving..." : "Save profile"}</Button>{profileStatus && <span className="text-xs text-[#8be9ff]">{profileStatus}</span>}</div>
                </div>
              </section>
            )}

            {showKeywordPanel && (
              <section className="relative overflow-hidden border-b border-[#273865] bg-[#080f22]/90 py-5" aria-label="Esoteric keyword signals">
                <div className="flex items-center justify-between gap-3"><div className="text-xs uppercase tracking-[0.2em] text-[#cbb8ff]">Esoteric signal extraction · {esotericKeywords.length}</div><button type="button" onClick={() => setShowKeywordPanel(false)} className="rounded-sm p-1 text-[#737b8f] hover:text-[#f3eadb]" aria-label="Close keyword signals"><X className="h-4 w-4" /></button></div>
                <div className="mt-3 flex flex-wrap gap-2">{esotericKeywords.length ? esotericKeywords.map((keyword) => <span key={keyword} className="border border-[#6f55c7] bg-[#21154d]/70 px-2 py-1 text-[0.68rem] uppercase tracking-[0.12em] text-[#d7c7ff] shadow-[0_0_18px_rgba(139,92,246,0.22)]">{keyword}</span>) : <span className="text-sm text-[#737b8f]">No esoteric signal has surfaced yet. Ask the deeper question.</span>}</div>
              </section>
            )}

            {showVoicePanel && (
              <section className="relative overflow-hidden border-b border-[#273865] bg-[#080f22]/90 py-5" aria-label="Voice controls">
                <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-[#8be9ff]"><Mic className="h-4 w-4" /> Voice resonance</div><button type="button" onClick={() => setShowVoicePanel(false)} className="rounded-sm p-1 text-[#737b8f] hover:text-[#f3eadb]" aria-label="Close voice controls"><X className="h-4 w-4" /></button></div>
                <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto_auto]">
                  <select aria-label="Preferred voice" value={profileDraft.preferredVoice} onChange={(event) => setProfileDraft((draft) => ({ ...draft, preferredVoice: event.target.value }))} className="h-10 rounded-none border border-[#273865] bg-[#0d1630] px-3 text-sm text-[#f4f4f5] outline-none focus:border-[#8be9ff]"><option value="">System default voice</option>{voices.map((voice) => <option key={`${voice.name}-${voice.lang}`} value={voice.name}>{voice.name} · {voice.lang}</option>)}</select>
                  <label className="flex items-center gap-2 text-xs text-[#a6aec0]">Rate <input aria-label="Voice rate" type="range" min="60" max="140" value={profileDraft.voiceRate} onChange={(event) => setProfileDraft((draft) => ({ ...draft, voiceRate: Number(event.target.value) }))} /></label>
                  <label className="flex items-center gap-2 text-xs text-[#a6aec0]">Pitch <input aria-label="Voice pitch" type="range" min="70" max="130" value={profileDraft.voicePitch} onChange={(event) => setProfileDraft((draft) => ({ ...draft, voicePitch: Number(event.target.value) }))} /></label>
                </div>
                <p className="mt-3 text-xs leading-6 text-[#737b8f]">Speech output: {voiceSupport.output ? "available through this browser" : "unavailable in this browser"}. Speech input: {voiceSupport.input ? "available through this browser" : "unavailable in this browser"}.</p>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" onClick={isSpeaking ? stopSpeaking : speakLastPortalMessage} disabled={!messages.some((message) => message.role === "portal")} className="rounded-none border border-[#273865] bg-transparent text-[#8be9ff] hover:bg-[#13213e]">
                      {isSpeaking ? <Pause className="mr-2 h-4 w-4 animate-pulse" /> : <Volume2 className="mr-2 h-4 w-4" />}
                      {isSpeaking ? "Interrupt voice" : "Speak last response"}
                    </Button>
                    <Button type="button" onClick={handleSaveProfile} disabled={profileSaving} className="rounded-none bg-[#8be9ff] text-[#041018] hover:bg-[#c4f7ff]">
                      <Save className="mr-2 h-4 w-4" /> Save voice
                    </Button>
                  </div>
                  {isSpeaking && <div className="flex items-center gap-2 px-3 py-1 text-[0.62rem] uppercase tracking-[0.2em] text-[#8be9ff]" aria-label="Browser speech output active"><span className="h-2 w-2 animate-pulse rounded-full bg-[#8be9ff]" /> Browser speech output active</div>}
                </div>
              </section>
            )}

            {showCapabilityPanel && (
              <section className="relative overflow-hidden border-b border-[#273865] bg-[#080f22]/90 py-5" aria-label="KEIRA capability status">
                <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-[#8be9ff]"><Layers3 className="h-4 w-4" /> Sovereign runtime state</div><button type="button" onClick={() => setShowCapabilityPanel(false)} className="rounded-sm p-1 text-[#737b8f] hover:text-[#f3eadb]" aria-label="Close capability status"><X className="h-4 w-4" /></button></div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {runtimeStatusQuery.data ? Object.entries({
                    "DETERMINISTIC ENGINE": runtimeStatusQuery.data.status.deterministic,
                    "LOCAL MODEL": runtimeStatusQuery.data.discovery.state,
                    "MODEL RUNTIME": runtimeStatusQuery.data.status.localRuntime || "NOT CONFIGURED",
                    MEMORY: runtimeStatusQuery.data.status.localMemory,
                    REFLECTION: "READY",
                    RECURSION: "BOUNDED",
                    ADAPTATION: "CONTROLLED",
                    NETWORK: runtimeStatusQuery.data.status.network,
                    "EXTERNAL PROVIDERS": runtimeStatusQuery.data.status.externalProviders,
                    "OFFLINE MODE": runtimeStatusQuery.data.status.offlineMode,
                  }).map(([label, value]) => <div key={label} className="border border-[#273865] bg-[#0d1630] p-3"><div className="text-[0.58rem] uppercase tracking-[0.16em] text-[#737b8f]">{label}</div><div className="mt-2 text-sm uppercase tracking-[0.08em] text-[#8be9ff]">{String(value).replaceAll("_", " ")}</div></div>) : <p className="text-sm text-[#737b8f]">Loading factual runtime state…</p>}
                </div>
                {runtimeStatusQuery.data && <div className="mt-4 border border-[#273865] bg-[#0d1630] p-3 text-xs leading-6 text-[#a6aec0]">Model: {runtimeStatusQuery.data.discovery.model || "not configured"} · Runtime: {runtimeStatusQuery.data.discovery.runtime || "not configured"} · Inference: {runtimeStatusQuery.data.discovery.inferenceReady ? "ready" : "not ready"}{runtimeStatusQuery.data.discovery.error ? ` · ${runtimeStatusQuery.data.discovery.error}` : ""}</div>}
                <div className="mt-5 grid gap-3 md:grid-cols-2">{capabilitiesQuery.data?.map((capability) => <div key={capability.id} className="border border-[#273865] bg-[#0d1630] p-3"><div className="flex items-center justify-between gap-3"><span className="text-sm text-[#f3eadb]">{capability.label}</span><span className={`text-[0.58rem] uppercase tracking-[0.16em] ${capability.status === "available" ? "text-[#8be9ff]" : "text-[#d7c7ff]"}`}>{capability.status.replace("-", " ")}</span></div><p className="mt-2 text-xs leading-6 text-[#a6aec0]">{capability.detail}</p></div>) || <p className="text-sm text-[#737b8f]">Loading verified capability status…</p>}</div>
              </section>
            )}

            {(stage || strategy) && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-[#202637] py-3 text-[0.68rem] uppercase tracking-[0.18em] text-[#a7a2c2]">
                {stage && <span>Context / {STAGE_LABELS[stage]}</span>}
                {strategy && <span>Mode / {STRATEGY_LABELS[strategy]}</span>}
                {lastMessageMetadata?.responseObjective && <span>Objective / {lastMessageMetadata.responseObjective}</span>}
                {lastMessageMetadata?.contextCarryover && <span>Carryover / {lastMessageMetadata.carryoverMessages ?? 0} prior messages</span>}
                {lastMessageMetadata?.qualityContract && <span className="text-[#8be9ff]" title={lastMessageMetadata.qualityContract}>Contract / explicit bounds</span>}
                {lastMessageMetadata?.stageTransition && <span className="text-[#e8ddff]">Transition / {lastMessageMetadata.stageTransition}</span>}
              </div>
            )}

            <div className="flex-1 overflow-y-auto py-8" aria-live="polite">
              {activeConversationId === null && (
                <div className="mx-auto flex max-w-2xl flex-col items-center justify-center py-24 text-center">
                  <Sparkles className="h-8 w-8 text-[#d7c7ff]" />
                  <h2 className="mt-5 font-serif text-3xl text-[#f3eadb]">What do you want to explore?</h2>
                  <p className="mt-3 max-w-md text-sm leading-7 text-[#9ba2b5]">Open a conversation. Bring the strange question, the hidden pattern, or the truth you want examined. The dialogue will follow what is actually said.</p>
                </div>
              )}

              {activeConversationId !== null && messages.length === 0 && (
                <div className="mx-auto max-w-2xl py-16">
                  <div className="border-l border-[#b8a1ff] pl-5">
                    <div className="text-[0.68rem] uppercase tracking-[0.22em] text-[#d7c7ff]">KEIRA ingress</div>
                    <p className="mt-3 font-serif text-2xl leading-snug text-[#f3eadb]">Bring the unfinished thought. We’ll follow it until the signal becomes clear.</p>
                  </div>
                </div>
              )}

              <div className="space-y-7">
                {messages.map((message, index) => (
                  <div key={`${message.role}-${index}`} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-3xl ${message.role === "user" ? "max-w-2xl" : "w-full"}`}>
                      <div className="mb-2 text-[0.62rem] uppercase tracking-[0.24em] text-[#737b8f]">{message.role === "user" ? "Operator" : "KEIRA"}</div>
                      <div className={`${message.role === "user" ? "border border-[#354064] bg-[#0d1224] text-[#f3eadb]" : "border-l border-[#b8a1ff] text-[#e7e9ef]"} px-4 py-1 text-[0.98rem] leading-8`}>
                        {message.role === "portal" ? (
                          <div className="portal-response-signal relative">
                            <Streamdown>{message.content}</Streamdown>
                            {extractEsotericKeywords(message.content).length > 0 && (
                              <div className="mt-4 flex flex-wrap items-center gap-1.5 border-t border-[#273865] pt-3 text-[0.62rem] uppercase tracking-[0.14em] text-[#cbb8ff]">
                                <span className="mr-1 text-[#8be9ff]">Extracted Signals</span>
                                {extractEsotericKeywords(message.content).map((keyword) => (
                                  <span key={keyword} className="rounded-sm border border-[#6f55c7] bg-[#21154d]/60 px-2 py-0.5 text-[#d7c7ff] shadow-[0_0_12px_rgba(139,92,246,0.2)]">
                                    {keyword}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="whitespace-pre-wrap">
                            {segmentEsotericText(message.content).map((segment, segmentIndex) =>
                              segment.keyword ? (
                                <mark key={`${segment.keyword}-${segmentIndex}`} className="rounded-sm bg-[#21154d] px-1 text-[#8be9ff] shadow-[0_0_14px_rgba(6,182,212,0.22)]">
                                  {segment.text}
                                </mark>
                              ) : (
                                <span key={segmentIndex}>{segment.text}</span>
                              )
                            )}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {isLoading && (
                  <div className="flex justify-start" role="status">
                    <div className="border-l border-[#b8a1ff] px-4 py-1 text-sm text-[#a6aec0]">
                      <span className="mr-2 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[#b8a1ff]" /> KEIRA is listening through the noise…
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>

            <div className="border-t border-[#1a2240] py-4">
              <div className="flex items-end gap-3">
                <Button type="button" aria-label={isListening ? "Stop listening" : "Speak a message"} onClick={toggleListening} disabled={activeConversationId === null || isLoading} className={`h-12 w-12 shrink-0 rounded-none border border-[#273865] p-0 ${isListening ? "bg-[#21154d] text-[#cbb8ff] shadow-[0_0_22px_rgba(139,92,246,0.35)]" : "bg-transparent text-[#8be9ff] hover:bg-[#101a32]"}`}><Mic className="h-4 w-4" /></Button>
                <Input
                  ref={composerRef}
                  aria-label="Message KEIRA"
                  placeholder="Ask KEIRA anything—information, analysis, planning, or reflection."
                  value={inputValue}
                  onChange={(event) => setInputValue(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void handleSendMessage();
                    }
                  }}
                  disabled={isLoading || activeConversationId === null}
                  className="h-12 rounded-none border-[#1a2240] bg-[#080d1b] text-[#f4f4f5] placeholder:text-[#737b8f] focus-visible:ring-[#8be9ff]"
                />
                <Button
                  aria-label="Send message"
                  onClick={() => void handleSendMessage()}
                  disabled={isLoading || activeConversationId === null || !inputValue.trim()}
                  className="h-12 w-12 shrink-0 rounded-none bg-[#d7c7ff] p-0 text-[#07090f] hover:bg-[#f0e8ff] disabled:bg-[#222b48]"
                >
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
              <div className="mt-3 flex justify-between gap-4 text-[0.62rem] uppercase tracking-[0.16em] text-[#737b8f]">
                <span>Conversation is the interface</span>
                <span className="hidden sm:inline">Unvarnished dialogue</span>
              </div>
            </div>
          </div>
        </section>

        <aside className="hidden w-[18rem] shrink-0 flex-col border-l border-[#1a2240] bg-[#060914] xl:flex" aria-label="KEIRA presence and conversation context">
          <div className="border-b border-[#1a2240] px-5 py-5">
            <div className="flex items-center justify-between text-[0.62rem] uppercase tracking-[0.22em] text-[#737b8f]">
              <span>Presence</span>
              <span className="flex items-center gap-2 text-[#e8ddff]"><span className="h-1.5 w-1.5 rounded-full bg-[#8be9ff]" /> {presenceState}</span>
            </div>
            <div className="mx-auto mt-7 grid h-24 w-24 place-items-center rounded-full border border-[#354064] bg-[radial-gradient(circle,rgba(139,92,246,0.24),rgba(6,182,212,0.16)_42%,transparent_72%)] text-[#f5ede3] shadow-[0_0_50px_rgba(139,92,246,0.24)] animate-pulse">
              <div className="grid h-12 w-12 place-items-center rounded-full border border-[#b8a1ff]/70"><Sparkles className="h-5 w-5" /></div>
            </div>
            <div className="mt-5 text-center text-[0.62rem] uppercase tracking-[0.2em] text-[#737b8f]">Signal state</div>
            <div className="mt-2 text-center font-serif text-lg text-[#f3eadb]">{currentState}</div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
            <div className="mb-3 text-[0.62rem] uppercase tracking-[0.22em] text-[#737b8f]">Dialogue signal</div>
            <div className="space-y-2">
              <div className="border border-[#202637] bg-[#0b1020] px-3 py-3"><div className="text-[0.62rem] uppercase tracking-[0.16em] text-[#a7a2c2]">Thread signal</div><div className="mt-1 line-clamp-2 text-sm leading-6 text-[#c7c9d5]">{conversationSignal}</div></div>
              <div className="border border-[#202637] bg-[#0b1020] px-3 py-3"><div className="text-[0.62rem] uppercase tracking-[0.16em] text-[#a7a2c2]">Dialogue frequency</div><div className="mt-1 text-sm leading-6 text-[#c7c9d5]">{stage ? STAGE_LABELS[stage] : "Awaiting Contact"}</div></div>
              <div className="border border-[#202637] bg-[#0b1020] px-3 py-3"><div className="text-[0.62rem] uppercase tracking-[0.16em] text-[#a7a2c2]">Unresolved thread</div><div className="mt-1 line-clamp-3 text-sm leading-6 text-[#c7c9d5]">{resonanceCue}</div></div>
              <button type="button" onClick={() => setShowKeywordPanel(true)} className="w-full border border-[#6f55c7] bg-[#21154d]/35 px-3 py-3 text-left transition hover:bg-[#21154d]/65"><div className="text-[0.62rem] uppercase tracking-[0.16em] text-[#cbb8ff]">Esoteric lexicon · {esotericKeywords.length}</div><div className="mt-2 flex flex-wrap gap-1">{esotericKeywords.slice(0, 5).map((keyword) => <span key={keyword} className="text-[0.62rem] text-[#8be9ff]">#{keyword}</span>)}{esotericKeywords.length === 0 && <span className="text-xs text-[#737b8f]">Awaiting signal</span>}</div></button>
            </div>
          </div>

          <div className="border-t border-[#1a2240] px-4 py-4 text-[0.62rem] uppercase tracking-[0.16em] text-[#5d667c]">No fabricated signal</div>
        </aside>
      </div>
    </main>
  );
}
