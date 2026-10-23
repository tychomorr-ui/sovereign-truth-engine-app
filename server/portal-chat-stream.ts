import * as portalChat from "./portal-chat";
import { retrieveUserContext } from "./portal-context-retrieval";
import { classifyLearningStage } from "./portal-stage-classifier";
import { selectDialogueStrategy } from "./portal-strategy-selector";
import { generateAdaptiveResponse, detectStageTransition } from "./portal-adaptive-response";
import { getDb } from "./db";
import { users } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { initializecMAPSession, processcMAPMessage, extractLivingContext } from "./cmap-portal-integration";
import { updateMissionState, type MissionState } from "./cmap-handshake";
import { getCarryoverMessageLimit, resolveContextCarryover } from "./keira-response-controls";
import { persistReceipt } from "./keira-durable-memory";
import { createReceipt } from "./sovereign-bus";
import { hashResponseRequest, readCachedResponse, writeCachedResponse } from "./response-cache";
import { ENV } from "./_core/env";
import { persistMistTrajectory, readMistTrajectoryByRoot } from "./mist-trajectory";
import { runMist, type MistResult } from "./mist-core";
import { toPersistableMistResult } from "./mist-portal-integration";
import type { MistEvidenceArtifact } from "./keira-prompt";
import { classifyFastPath } from "../client/src/lib/keira/fast-path";

const cmapSessions = new Map<number, MissionState>();

export async function streamPortalMessage(
  userId: number,
  conversationId: number,
  message: string,
  onToken: (token: string) => void,
  trajectoryRootCid?: string,
) {
  await portalChat.addMessage(conversationId, userId, "user", message);

  const fastPath = classifyFastPath(message);
  if (fastPath.isFastPath && fastPath.classification && fastPath.response) {
    const receipt = createReceipt({
      operation: "portal.conversation.fast_path",
      intelligence_mode: "deterministic",
      provider: "keira-fast-path",
      model: null,
      context_sources: [`fast-path:${fastPath.classification}`],
      policy: "deterministic fast path; zero retrieval and zero model inference; external providers disabled",
      verification: `canned persona response returned for ${fastPath.classification}; no retrieval or inference was attempted`,
      result_state: "PROVEN",
    });
    onToken(fastPath.response);
    await persistReceipt(userId, receipt);
    await portalChat.addMessage(conversationId, userId, "portal", fastPath.response);
    return {
      response: fastPath.response,
      metadata: {
        provider: "deterministic",
        modelId: null,
        cached: false,
        fastPath: fastPath.classification,
        receipt,
      },
    };
  }

  let missionState = cmapSessions.get(conversationId) ?? await initializecMAPSession(userId);
  missionState = processcMAPMessage(message, missionState).missionState;
  cmapSessions.set(conversationId, missionState);

  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const userRecord = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!userRecord.length) throw new Error("User not found");

  const userContext = await retrieveUserContext(userId, userRecord[0].createdAt);
  (userContext as any).profile = {
    customPersona: userRecord[0].customPersona,
    customInstructions: userRecord[0].customInstructions,
    modelTemperature: userRecord[0].modelTemperature,
    fastMode: userRecord[0].fastMode,
    predictiveSensitivity: userRecord[0].predictiveSensitivity,
    responseObjective: userRecord[0].responseObjective,
    contextCarryover: userRecord[0].contextCarryover,
  };
  const contextLedger = await portalChat.getContextEntries(userId);
  (userContext as any).contextLedger = contextLedger
    .filter((entry) => entry.isActive === 1)
    .map((entry) => ({ label: entry.label, content: entry.content, kind: entry.kind }));

  const stageClassification = classifyLearningStage(userContext);
  const strategySelection = selectDialogueStrategy(userContext, stageClassification, message);
  const conversationResult = await portalChat.getConversation(conversationId, userId);
  const carryoverPolicy = resolveContextCarryover(userRecord[0].contextCarryover);
  const recentMessages = conversationResult.messages
    .slice(0, -1)
    .slice(-getCarryoverMessageLimit(carryoverPolicy))
    .map((msg) => ({ role: msg.role as "user" | "portal", content: msg.content }));

  let mistEvidence: MistEvidenceArtifact[] = [];
  let mistResult: MistResult | null = null;
  if (trajectoryRootCid && /^[a-f0-9]{64}$/i.test(trajectoryRootCid)) {
    const trajectory = await readMistTrajectoryByRoot(userId, trajectoryRootCid);
    mistEvidence = trajectory?.merkle.leaves.flatMap((leaf) => {
      try {
        const payload = JSON.parse(leaf.payloadJson) as { artifact?: { content?: unknown } };
        const snippet = typeof payload.artifact?.content === "string" ? payload.artifact.content : "";
        return snippet ? [{ cid: leaf.artifactCid, snippet }] : [];
      } catch {
        return [];
      }
    }) ?? [];
  }
  if (!mistEvidence.length) {
    mistResult = await runMist(message, { userId, maxArtifacts: 30 });
    mistEvidence = mistResult.artifacts.map((artifact) => ({ cid: artifact.cid, snippet: artifact.content }));
    if (mistResult.artifacts.length > 0) {
      void persistMistTrajectory(userId, toPersistableMistResult(mistResult)).catch((error) => {
        console.warn("[MIST] async trajectory persistence failed", error instanceof Error ? error.message : String(error));
      });
    }
  }

  const selectedModel = userRecord[0].fastMode === 1 && ENV.localLlmFallbackModel
    ? ENV.localLlmFallbackModel
    : ENV.localLlmModel;
  const effectiveTrajectoryRootCid = trajectoryRootCid || mistResult?.trajectory_root_cid || undefined;
  const cacheKey = hashResponseRequest({ userId, query: message, trajectoryRootCid: effectiveTrajectoryRootCid, model: selectedModel });
  const cached = await readCachedResponse(cacheKey);
  if (cached) {
    onToken(cached.response);
    const receipt = createReceipt({
      operation: "portal.conversation.generate",
      intelligence_mode: "local_model",
      provider: "local-cache",
      model: cached.model,
      context_sources: ["response-cache"],
      policy: "user-scoped local response cache; external providers disabled",
      verification: "previously generated local response replayed; no new inference performed",
      result_state: "CACHED_INFERENCE",
    });
    await persistReceipt(userId, receipt);
    await portalChat.addMessage(conversationId, userId, "portal", cached.response);
    return { response: cached.response, metadata: { provider: "local", modelId: cached.model, cached: true, receipt } };
  }

  const adaptiveResponse = await generateAdaptiveResponse(
    message,
    userContext,
    strategySelection,
    recentMessages,
    userRecord[0].modelTemperature,
    onToken,
    { model: selectedModel, fallbackModel: ENV.localLlmFallbackModel || undefined, mistEvidence },
  );

  await writeCachedResponse({
    cacheKey,
    userId,
    queryHash: hashResponseRequest({ userId, query: message, trajectoryRootCid: effectiveTrajectoryRootCid, model: selectedModel }),
    trajectoryRootCid: effectiveTrajectoryRootCid,
    response: adaptiveResponse.response,
    model: adaptiveResponse.metadata.modelId ?? selectedModel,
  });

  await persistReceipt(userId, adaptiveResponse.metadata.receipt);
  await portalChat.addMessage(conversationId, userId, "portal", adaptiveResponse.response);
  const updates = adaptiveResponse.metadata.learningMemoryUpdates;
  if (Object.keys(updates).length > 0) await portalChat.updateLearningMemory(userId, updates);

  const stageTransition = detectStageTransition(adaptiveResponse.response, userContext);
  const livingContext = extractLivingContext(adaptiveResponse.response, missionState);
  missionState = updateMissionState(missionState, {
    ...livingContext,
    nextAction: adaptiveResponse.metadata.nextSuggestedAction || missionState.nextAction,
  });
  cmapSessions.set(conversationId, missionState);

  return {
    response: adaptiveResponse.response,
    metadata: {
      provider: adaptiveResponse.metadata.provider,
      modelId: adaptiveResponse.metadata.modelId,
      receipt: adaptiveResponse.metadata.receipt,
      strategy: adaptiveResponse.strategy,
      learningStage: stageClassification.stage,
      stageTransition: stageTransition.isTransitioning ? stageTransition.nextStage : null,
    },
  };
}
