/**
 * Trifecta Integration Test Suite
 * 
 * End-to-end tests for the complete Trifecta system.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn(async () => ({
    id: "test-local-response",
    created: 0,
    model: "test-model",
    choices: [{
      index: 0,
      message: {
        role: "assistant",
        content: "A coherent synthesis connects the supplied evidence without adding unsupported claims.",
      },
      finish_reason: "stop",
    }],
  })),
}));
import { createPersonalityManifesto, generatePersonalitySystemPrompt } from "./trifecta-personality-core";
import { createOrchestrationStrategy, orchestratePillars } from "./trifecta-orchestration";
import { createTruthFilterCriteria, synthesizeResponses } from "./trifecta-truth-filter";
import { detectOptimalStrategy } from "./trifecta-auto-detector";
import { generateOpinionatedAnalysis } from "./trifecta-opinionated-analysis";
import { synthesizeLongForm } from "./trifecta-longform-synthesis";
import { scoreResponse, compareAgainstFrontierModels } from "./trifecta-benchmarks";
import { initializeTuning, updateTuningFromFeedback, generateTuningReport } from "./trifecta-feedback-loop";
import type { UserContext } from "./portal-context-retrieval";

// Mock user context
const mockUserContext: UserContext = {
  userId: 1,
  synthesis: {
    learningStage: "exploration",
    breakthroughReadiness: 45,
    resistanceLevel: 35,
    primaryFocus: "understanding patterns",
    emotionalTrajectory: "ascending",
  },
  mirrorHistory: [],
  portalLearningMemory: {
    patterns: ["pattern1", "pattern2"],
    growthAreas: ["area1"],
    resistancePoints: ["point1"],
    breakthroughMoments: [],
    evolutionTimeline: [],
  },
  metadata: {
    subscriptionTier: "pro",
    accountAge: 180,
    totalReflections: 25,
  },
};

describe("Trifecta Integration Tests", () => {
  describe("Personality Core", () => {
    it("should create personality manifesto with balanced temperature", () => {
      const manifesto = createPersonalityManifesto(mockUserContext, "logic");
      expect(manifesto.temperature.logic).toBeGreaterThan(manifesto.temperature.edge);
      expect(manifesto.temperature.logic).toBeGreaterThan(manifesto.temperature.utility);
    });

    it("should generate system prompt with user context", () => {
      const manifesto = createPersonalityManifesto(mockUserContext, "edge");
      const prompt = generatePersonalitySystemPrompt(manifesto, mockUserContext);
      expect(prompt).toContain("Sovereign Truth Portal");
      expect(prompt).toContain("exploration");
    });

    it("should adjust temperature for resistance stage", () => {
      const resistanceContext: UserContext = {
        ...mockUserContext,
        synthesis: { ...mockUserContext.synthesis, learningStage: "resistance" },
      };
      const manifesto = createPersonalityManifesto(resistanceContext, "logic");
      expect(manifesto.temperature.edge).toBeGreaterThan(0.25);
    });
  });

  describe("Orchestration Layer", () => {
    it("should create orchestration strategy with weighted pillars", () => {
      const strategy = createOrchestrationStrategy(mockUserContext.synthesis.learningStage, "logic");
      expect(strategy.weights.claude).toBeGreaterThan(strategy.weights.grok);
      expect(strategy.weights.claude).toBeGreaterThan(strategy.weights.chatgpt);
    });

    it("should execute pillars in parallel mode", async () => {
      const strategy = createOrchestrationStrategy(mockUserContext.synthesis.learningStage, "logic");
      expect(strategy.executionMode).toBe("parallel");
    });
  });

  describe("Truth Filter", () => {
    it("should create filter criteria based on user context", () => {
      const criteria = createTruthFilterCriteria(mockUserContext, "technical");
      expect(criteria.domainBias.technical).toBeGreaterThan(criteria.domainBias.creative);
    });

    it("should adjust stage bias for exploration stage", () => {
      const criteria = createTruthFilterCriteria(mockUserContext, "general");
      expect(criteria.stageBias.exploration).toBeGreaterThan(0.3);
    });
  });

  describe("Auto-Detection Engine", () => {
    it("should detect logic strategy for exploration stage", () => {
      const detection = detectOptimalStrategy(
        mockUserContext,
        "Can you explain the logical structure of this?",
        []
      );
      expect(detection.requiredStrategy).toBe("logic");
      expect(detection.confidence).toBeGreaterThan(0.3);
    });

    it("should detect edge strategy for resistance signals", () => {
      const detection = detectOptimalStrategy(
        mockUserContext,
        "But how can this be true when everything contradicts it?",
        []
      );
      expect(detection.execution.grokWeight).toBeGreaterThan(0.3);
    });

    it("should detect utility strategy for action-oriented messages", () => {
      const detection = detectOptimalStrategy(mockUserContext, "How do I implement this now?", []);
      expect(detection.execution.chatgptWeight).toBeGreaterThan(0.3);
    });
  });

  describe("Opinionated Analysis", () => {
    it("should generate opinionated analysis with real-time context", async () => {
      const analysis = await generateOpinionatedAnalysis("What about AI and the future?");
      expect(analysis.provocativeInsight).toBeTruthy();
      expect(analysis.contrarian).toBeTruthy();
      expect(analysis.stance.position).toBeTruthy();
    });

    it("should include sentiment analysis", async () => {
      const analysis = await generateOpinionatedAnalysis("Market trends in tech");
      expect(analysis.contextualRelevance.sentiment).toBeGreaterThanOrEqual(-1);
      expect(analysis.contextualRelevance.sentiment).toBeLessThanOrEqual(1);
    });
  });

  describe("Long-Form Synthesis", () => {
    it("should synthesize long-form documents with coherence", async () => {
      const documents = [
        "The first principle is that consciousness emerges from complexity.",
        "This complexity arises from interconnected neural networks.",
        "These networks process information through quantum mechanisms.",
      ];
      const synthesis = await synthesizeLongForm(documents, 5000);
      expect(synthesis.structure.thesis).toBeTruthy();
      expect(synthesis.coherenceChain.logicalThreads.length).toBeGreaterThan(0);
    });

    it("should maintain truth thread across synthesis", async () => {
      const documents = [
        "Truth requires evidence.",
        "Evidence comes from observation.",
        "Observation requires consciousness.",
      ];
      const synthesis = await synthesizeLongForm(documents, 5000);
      expect(synthesis.structure.thesis).toBeTruthy();
    }, { timeout: 15000 });
  });

  describe("Benchmarks", () => {
    it("should score response on domain synthesis", () => {
      const response =
        "This connects neuroscience to economics through market dynamics and philosophical frameworks.";
      const score = scoreResponse(response);
      expect(score.domainSynthesis).toBeGreaterThan(10);
    });

    it("should score response on creativity", () => {
      const response = "This unprecedented approach challenges conventional wisdom in novel ways.";
      const score = scoreResponse(response);
      expect(score.creativity).toBeGreaterThan(10);
    });

    it("should score response on logical depth", () => {
      const response =
        "Therefore, the premise leads to a conclusion. Because of this logic, we can imply...";
      const score = scoreResponse(response);
      expect(score.logicalDepth).toBeGreaterThan(10);
    });

    it("should compare against frontier models", () => {
      const response = "Advanced synthesis connecting multiple domains with novel insights.";
      const comparison = compareAgainstFrontierModels(response);
      expect(comparison.portal).toBeTruthy();
      expect(comparison.gpt4o).toBeTruthy();
      expect(comparison.claudeOpus).toBeTruthy();
      expect(comparison.grok).toBeTruthy();
    });
  });

  describe("Feedback Loop", () => {
    it("should initialize tuning for new user", () => {
      const tuning = initializeTuning(1);
      expect(tuning.userId).toBe(1);
      expect(tuning.evolutionaryWeights.grokWeight).toBeCloseTo(0.33, 1);
      expect(tuning.evolutionStage).toBe("initialization");
    });

    it("should update tuning from feedback", () => {
      const tuning = initializeTuning(1);
      const feedback = {
        userId: 1,
        conversationId: "conv1",
        messageId: "msg1",
        satisfaction: 5,
        helpfulness: 5,
        clarity: 5,
        truthfulness: 5,
        novelty: 5,
        applicability: 5,
        engagementLevel: 5,
        wouldRecommend: true,
        timestamp: new Date().toISOString(),
      };

      const update = updateTuningFromFeedback(tuning, feedback);
      expect(update.newWeights).toBeTruthy();
      expect(tuning.feedbackHistory.length).toBe(1);
    });

    it("should progress through evolution stages", () => {
      const tuning = initializeTuning(1);

      for (let i = 0; i < 25; i++) {
        const feedback = {
          userId: 1,
          conversationId: `conv${i}`,
          messageId: `msg${i}`,
          satisfaction: Math.floor(Math.random() * 5) + 1,
          helpfulness: Math.floor(Math.random() * 5) + 1,
          clarity: Math.floor(Math.random() * 5) + 1,
          truthfulness: Math.floor(Math.random() * 5) + 1,
          novelty: Math.floor(Math.random() * 5) + 1,
          applicability: Math.floor(Math.random() * 5) + 1,
          engagementLevel: Math.floor(Math.random() * 5) + 1,
          wouldRecommend: Math.random() > 0.5,
          timestamp: new Date().toISOString(),
        };
        updateTuningFromFeedback(tuning, feedback);
      }

      expect(tuning.evolutionStage).toBe("optimization");
    });

    it("should generate tuning report", () => {
      const tuning = initializeTuning(1);
      const feedback = {
        userId: 1,
        conversationId: "conv1",
        messageId: "msg1",
        satisfaction: 4,
        helpfulness: 4,
        clarity: 4,
        truthfulness: 5,
        novelty: 3,
        applicability: 4,
        engagementLevel: 4,
        wouldRecommend: true,
        timestamp: new Date().toISOString(),
      };

      updateTuningFromFeedback(tuning, feedback);
      const report = generateTuningReport(tuning);
      expect(report).toContain("Trifecta Tuning Report");
      expect(report).toContain("Evolution Stage");
    });
  });

  describe("End-to-End Flow", () => {
    it("should complete full Trifecta flow: detect -> manifest -> orchestrate -> synthesize", async () => {
      // 1. Detect strategy
      const detection = detectOptimalStrategy(
        mockUserContext,
        "Explain the deep logic behind this pattern",
        []
      );
      expect(detection.requiredStrategy).toBe("logic");

      // 2. Create personality
      const manifesto = createPersonalityManifesto(mockUserContext, detection.requiredStrategy);
      expect(manifesto.temperature.logic).toBeGreaterThan(0.4);

      // 3. Create orchestration strategy
      const orchestrationStrategy = createOrchestrationStrategy(
        mockUserContext.synthesis.learningStage,
        detection.requiredStrategy
      );
      expect(orchestrationStrategy.weights.claude).toBeGreaterThan(0.4);

      // 4. Create truth filter
      const filterCriteria = createTruthFilterCriteria(mockUserContext, "analytical");
      expect(filterCriteria).toBeTruthy();

      // 5. Generate opinionated analysis
      const analysis = await generateOpinionatedAnalysis("What about future trends?");
      expect(analysis.provocativeInsight).toBeTruthy();

      // 6. Score response
      const response = "This connects multiple domains through logical reasoning and novel insights.";
      const score = scoreResponse(response);
      // Calculate sovereign truth score
      const sovereignScore = (score.domainSynthesis * 0.25 + score.creativity * 0.2 + score.logicalDepth * 0.25 + score.culturalRelevance * 0.15 + score.edgeScore * 0.15);
      expect(sovereignScore).toBeGreaterThan(0);

      // 7. Initialize and update tuning
      const tuning = initializeTuning(mockUserContext.userId);
      const feedback = {
        userId: mockUserContext.userId,
        conversationId: "conv1",
        messageId: "msg1",
        satisfaction: 4,
        helpfulness: 4,
        clarity: 4,
        truthfulness: 5,
        novelty: 4,
        applicability: 4,
        engagementLevel: 4,
        wouldRecommend: true,
        timestamp: new Date().toISOString(),
      };
      updateTuningFromFeedback(tuning, feedback);
      expect(tuning.performance.overallScore).toBeGreaterThan(0);
    });
  });
});
