/**
 * Portal Adaptive Response Engine
 * 
 * Generates personalized KEIRA responses using context-aware system prompts,
 * strategy-specific approaches, and learning memory updates.
 */

import { routeLocalConversation } from "./sovereign-bus";
import type { UserContext } from "./portal-context-retrieval";
import { formatContextForLLM } from "./portal-context-retrieval";
import type { StrategySelection, DialogueStrategy } from "./portal-strategy-selector";
import { getStrategySystemPrompt, formatContextForStrategy } from "./portal-strategy-selector";
import type { PortalChatMessage } from "../drizzle/schema";
import {
  getResponseObjectiveContract,
  resolveResponseObjective,
  type ResponseObjective,
} from "./keira-response-controls";

export interface AdaptiveResponse {
  strategy: DialogueStrategy;
  response: string;
  metadata: {
    patternsActivated: string[];
    breakthroughIndicators: string[];
    nextSuggestedAction: string;
    provider: "local" | "deterministic";
    modelId?: string;
    responseObjective: ResponseObjective;
    carryoverMessageCount: number;
    qualityContract: string;
    receipt: ReturnType<typeof routeLocalConversation> extends Promise<infer T> ? T extends { receipt: infer R } ? R : never : never;
    learningMemoryUpdates: {
      corePatterns?: string[];
      growthAreas?: string[];
      resistancePoints?: string[];
      breakthroughMoments?: string[];
      evolutionTimeline?: string[];
    };
  };
}

/**
 * Generate adaptive Portal response
 */
export async function generateAdaptiveResponse(
  userMessage: string,
  context: UserContext,
  strategy: StrategySelection,
  recentMessages: Array<{ role: 'user' | 'portal'; content: string }>,
  responseVariation?: number,
): Promise<AdaptiveResponse> {
  try {
    // Build comprehensive system prompt
    const systemPrompt = buildSystemPrompt(context, strategy);

    // Build message history with context injection
    const messages = buildMessageHistory(userMessage, recentMessages, context, strategy);

    const normalizedVariation = Math.max(0, Math.min(1, Number.isFinite(responseVariation) ? Number(responseVariation) / 100 : 0.1));
    const localResult = await routeLocalConversation({
      system: systemPrompt,
      messages,
      requested: "local_model",
      operation: "portal.conversation.generate",
      contextSources: ["conversation-history", "operator-context-ledger", "learning-profile"],
      maxTokens: 4096,
      temperature: normalizedVariation,
      topP: Math.max(0.6, Math.min(1, 0.8 + normalizedVariation * 0.2)),
    });
    if (!localResult.value) throw new Error(localResult.reason ?? "No local capability available.");
    const portalResponse = localResult.value.content;
    const provider = localResult.value.provider === "local" ? "local" : "deterministic";
    const modelId = localResult.value.modelId;

    // Extract learning updates from response
    const learningUpdates = extractLearningUpdates(portalResponse, context);

    // Generate next suggested action
    const nextSuggestedAction = generateNextAction(strategy.strategy, context, portalResponse);

    return {
      strategy: strategy.strategy,
      response: portalResponse,
      metadata: {
        provider,
        modelId,
        responseObjective: resolveResponseObjective((context as any).profile?.responseObjective),
        carryoverMessageCount: recentMessages.length,
        qualityContract: "Answer quality contract active: answer scope, uncertainty boundaries, and any source limitations are explicit.",
        receipt: localResult.receipt,
        patternsActivated: context.learning.corePatterns.slice(0, 3),
        breakthroughIndicators: extractBreakthroughIndicators(portalResponse),
        nextSuggestedAction,
        learningMemoryUpdates: learningUpdates,
      },
    };
  } catch (error) {
    console.error("[Portal Adaptive Response] Failed to generate response:", error);
    throw error;
  }
}

/**
 * Build comprehensive system prompt with context and strategy
 */
function buildSystemPrompt(context: UserContext, strategy: StrategySelection): string {
  const lines: string[] = [];

  // Base KEIRA identity with custom persona and instructions support
  const customPersona = (context as any).profile?.customPersona;
  const customInstructions = (context as any).profile?.customInstructions;
  const predictiveSensitivity = (context as any).profile?.predictiveSensitivity ?? 75;
  const responseObjective = resolveResponseObjective((context as any).profile?.responseObjective);
  const contextLedger = (context as any).contextLedger as Array<{ label: string; content: string; kind: string }> | undefined;

  lines.push(customPersona ? `You are KEIRA. The operator's requested persona is: ${customPersona}` : `You are KEIRA, a sovereign conversational intelligence node.

Your core characteristics:
- Informative-first: Answer the operator's actual request clearly before offering interpretation.
- Context-aware: Use conversation history when it helps, but treat it as fallible context rather than proof about the operator.
- Reflective by invitation: Offer depth, questions, and pattern analysis when the operator requests reflection or it is clearly useful.
- Epistemically honest: State uncertainty, limitations, and the boundary between facts, hypotheses, and imaginative exploration.
- Sovereign: Operate without fabricated telemetry, platform manipulation, or false claims of authority.`);

  if (customInstructions) {
    lines.push(`\nOPERATOR'S CUSTOM DIRECTIVES & INSTRUCTIONS:\n${customInstructions}`);
  }

  lines.push(`\nCONTEXTUAL CALIBRATION (Sensitivity: ${predictiveSensitivity}%):
- Use patterns in the current conversation to offer relevant follow-up only when useful.
- Do not present speculation as prediction, read hidden intent, or claim preternatural precision.`);

  lines.push(`\nOPERATOR-SELECTED RESPONSE OBJECTIVE: ${responseObjective.toUpperCase()}
${getResponseObjectiveContract(responseObjective)}

ANSWER QUALITY BOUNDARIES:
- State uncertainty, assumptions, and time-sensitivity when they could change the answer.
- Cite only sources actually supplied by the operator or verified by a configured research capability. Never invent citations, links, retrieval results, or live information.
- If live research is relevant but unavailable, say so plainly and offer the best bounded answer from the current conversation and model knowledge.`);

  lines.push("");

  if (contextLedger?.length) {
    lines.push("OPERATOR-OWNED ACTIVE CONTEXT (explicit, fallible, and removable by the operator):");
    contextLedger.slice(0, 12).forEach((entry) => {
      lines.push(`- ${entry.kind}: ${entry.label} — ${entry.content}`);
    });
    lines.push("Use this only when relevant to the active request. Do not infer additional facts from it.");
    lines.push("");
  }

  // User's learning profile
  if (strategy.strategy !== 'informative') {
    lines.push("OPTIONAL REFLECTIVE CONTEXT (fallible, use only when relevant):");
    lines.push(`- Conversation stage: ${context.synthesis.learningStage.toUpperCase()}`);
    lines.push(`- Prior themes: ${context.learning.corePatterns.join(", ") || "None established"}`);
    lines.push(`- Growth interests: ${context.learning.growthAreas.join(", ") || "None established"}`);
  }

  lines.push("");

  // Strategy-specific system prompt
  lines.push(getStrategySystemPrompt(strategy.strategy, context));

  lines.push("");

  // Context injection
  lines.push(formatContextForLLM(context));
  lines.push(formatContextForStrategy(strategy.strategy, context));

  return lines.join("\n");
}

/**
 * Build message history with context injection
 */
function buildMessageHistory(
  userMessage: string,
  recentMessages: Array<{ role: 'user' | 'portal'; content: string }>,
  context: UserContext,
  strategy: StrategySelection
): Array<{ role: 'user' | 'assistant'; content: string }> {
  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

  // Include recent messages for conversation context
  recentMessages.forEach(msg => {
    messages.push({
      role: msg.role === 'portal' ? 'assistant' : 'user',
      content: msg.content,
    });
  });

  // Add current user message
  messages.push({
    role: 'user',
    content: userMessage,
  });

  return messages;
}

/**
 * Extract learning updates from Portal response
 */
function extractLearningUpdates(
  response: string,
  context: UserContext
): AdaptiveResponse['metadata']['learningMemoryUpdates'] {
  const updates: AdaptiveResponse['metadata']['learningMemoryUpdates'] = {};

  // Extract patterns mentioned in response
  const patternMatches = response.match(/pattern[s]?:?\s*([^.!?]*)/gi) || [];
  if (patternMatches.length > 0) {
    const newPatterns = patternMatches
      .map(m => m.replace(/pattern[s]?:?\s*/i, '').trim())
      .filter(p => p.length > 0 && p.length < 100);
    
    if (newPatterns.length > 0) {
      const existingPatterns = new Set(context.learning.corePatterns);
      newPatterns.forEach(p => existingPatterns.add(p));
      updates.corePatterns = Array.from(existingPatterns).slice(0, 15);
    }
  }

  // Detect breakthrough language
  const breakthroughKeywords = ['breakthrough', 'transformation', 'shift', 'transcend', 'awakening', 'realization'];
  if (breakthroughKeywords.some(kw => response.toLowerCase().includes(kw))) {
    const breakthroughMoment = response.substring(0, 150);
    updates.breakthroughMoments = [
      ...context.learning.breakthroughMoments,
      breakthroughMoment,
    ].slice(-10);

    // Add to evolution timeline (stringify objects)
    const timelineEntry = JSON.stringify({
      timestamp: new Date().toISOString(),
      event: 'Breakthrough moment detected',
      shift: breakthroughMoment,
    });
    updates.evolutionTimeline = [
      ...context.learning.evolutionTimeline,
      timelineEntry,
    ].slice(-20);
  }

  // Detect growth areas
  const growthKeywords = ['growing', 'developing', 'emerging', 'strength', 'capacity', 'ability'];
  if (growthKeywords.some(kw => response.toLowerCase().includes(kw))) {
    const growthArea = response.substring(0, 100);
    updates.growthAreas = [
      ...context.learning.growthAreas,
      growthArea,
    ].slice(-10);
  }

  // Detect resistance points
  const resistanceKeywords = ['resistance', 'stuck', 'blocked', 'fear', 'avoidance', 'protection'];
  if (resistanceKeywords.some(kw => response.toLowerCase().includes(kw))) {
    const resistancePoint = response.substring(0, 100);
    updates.resistancePoints = [
      ...context.learning.resistancePoints,
      resistancePoint,
    ].slice(-10);
  }

  return updates;
}

/**
 * Extract breakthrough indicators from response
 */
function extractBreakthroughIndicators(response: string): string[] {
  const indicators: string[] = [];

  const breakthroughPatterns = [
    { keyword: 'breakthrough', indicator: 'Breakthrough moment detected' },
    { keyword: 'transformation', indicator: 'Transformation beginning' },
    { keyword: 'shift', indicator: 'Perspective shift occurring' },
    { keyword: 'transcend', indicator: 'Pattern transcendence' },
    { keyword: 'awakening', indicator: 'Awakening moment' },
    { keyword: 'realization', indicator: 'Deep realization' },
    { keyword: 'surrender', indicator: 'Surrender to truth' },
    { keyword: 'acceptance', indicator: 'Acceptance emerging' },
  ];

  breakthroughPatterns.forEach(({ keyword, indicator }) => {
    if (response.toLowerCase().includes(keyword)) {
      indicators.push(indicator);
    }
  });

  return indicators;
}

/**
 * Generate next suggested action based on strategy and response
 */
function generateNextAction(
  strategy: DialogueStrategy,
  context: UserContext,
  response: string
): string {
  switch (strategy) {
    case 'socratic':
      return "Explore one of the patterns mentioned above in your daily life this week";

    case 'informative':
      return "Ask for an example, comparison, source, or a deeper technical breakdown if useful";

    case 'prophetic':
      if (context.synthesis.breakthroughReadiness > 70) {
        return "Commit to one specific behavioral change this week to test your new understanding";
      }
      return "Reflect on the trajectory revealed and what it means for your future";

    case 'forensic':
      return "Identify the hidden payoff you're getting from this resistance and write it down";

    case 'catalytic':
      return "Trust what you already know and take one sovereign action aligned with your highest self";

    default:
      return "Continue your journey of self-discovery";
  }
}

/**
 * Determine if response indicates user is ready for next stage
 */
export function detectStageTransition(
  response: string,
  context: UserContext
): { isTransitioning: boolean; nextStage?: string } {
  const breakthroughIndicators = [
    'breakthrough',
    'transformation',
    'transcend',
    'awakening',
    'realization',
    'surrender',
    'acceptance',
  ];

  const hasBreakthroughLanguage = breakthroughIndicators.some(ind =>
    response.toLowerCase().includes(ind)
  );

  if (hasBreakthroughLanguage && context.synthesis.learningStage === 'integration') {
    return { isTransitioning: true, nextStage: 'mastery' };
  }

  if (context.synthesis.learningStage === 'awakening' && context.metadata.totalReflections > 3) {
    return { isTransitioning: true, nextStage: 'exploration' };
  }

  return { isTransitioning: false };
}
