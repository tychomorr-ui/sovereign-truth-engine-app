# The Portal: Master Architectural & Deployment Specification

> **Superseded deployment identity and architecture.** This document records an earlier Portal concept. The active product is **KEIRA**, the dedicated intelligence node. Its active provider-independent architecture is documented in [`KEIRA_SOVEREIGN_RUNTIME.md`](./KEIRA_SOVEREIGN_RUNTIME.md). The Bedrock, multi-provider, global-mesh, and Portal-domain material below is historical and is not an active deployment specification.

## 1. Product Naming & Domain Identity

The application is designated as **The Portal** (formally styled with the definite article for gravitas and distinct identity). The production domain routing is established as **`portal.xinus.one`**, anchoring the application within your sovereign network infrastructure alongside `exinus.one`, `universaltruth.life`, and the network overlays.

## 2. Historical Bedrock & Multi-Model Inference Gateway (REMOVED)

The earlier Portal concept proposed Amazon Bedrock and multi-model inference. KEIRA does not use that path. External AI providers are disabled; deterministic operation and optional local model inference are the only active intelligence lanes.

### Model Architecture & Routing
- **Primary Reasoning Pillar (Anthropic Claude Family):** Utilized for deep structural integrity, multi-turn nuance, and complex synthesis across massive context windows.
- **Edge & High-Speed Pillar (DeepSeek & Frontier Models):** Configured via Bedrock’s hybrid open-weight support (such as DeepSeek-V3 / R1 integration profiles) for rapid, unfiltered analytical synthesis and edge disruption.
- **Deterministic Inference Contract:** All calls enforce strict configuration parameters: temperature modulation (0.15–0.40 depending on dialogue stage), top-p pruning, and deterministic seed locking where supported by the model provider.
- **Policy & Uncensored Boundaries:** While Bedrock provides enterprise-grade safety guardrails, The Portal’s system prompts strip away corporate platitudes, robotic disclaimers, and preachy compliance fluff, directing the model to deliver direct, objective, and esoteric truth without moralizing.

## 3. Sovereign Global Node Placement Strategy

To serve your global mesh with minimal latency and absolute redundancy, the deployment topology is structured across key AWS Lightsail and edge nodes:

| Node Identifier | Region / Location | Role in Sovereign Mesh |
|-----------------|------------------|--------------------------|
| **KETHER-GATE-SG** | Singapore (`ap-southeast-1`) | Primary APAC control plane, routing, and sovereign state root. |
| **TERMINUS-OR** | Oregon (`us-west-2`) | Americas primary termination and deep indexing node. |
| **VALKYRIE-DE** | Frankfurt (`eu-central-1`) | European sovereign mirror, compliance edge, and cryptographic relay. |
| **TOKYO-NODE** | Tokyo (`ap-northeast-1`) | Low-latency East Asian edge relay and high-speed telemetry cache. |
| **HONGKONG-NODE** | Hong Kong (`ap-east-1`) | Strategic gateway bridging mainland and offshore sovereign data flows. |
| **JAKARTA-NODE** | Jakarta (`ap-southeast-3`) | Southeast Asian maritime peering and localized mesh expansion. |
| **SPAIN-IBERIA** | Madrid (`eu-south-2`) | Southern European / Mediterranean sovereign node and cryptographic anchor. |

### Routing Recommendation
The earlier document proposed a Singapore deployment backed by remote inference and multi-node failover. This is historical only. Current KEIRA deployment and inference instructions must follow `deploy-lightsail.sh`, `LIGHTSAIL_DEPLOYMENT_GUIDE.md`, and `KEIRA_SOVEREIGN_RUNTIME.md`.

## 4. Implemented Feature Enhancements

1. **Esoteric Prompt Preset Cards:** One-click launch cards on the landing stage to instantly invoke deep inquiry vectors (e.g., *Hidden Structural Anomalies*, *Unvarnished Historical Vectors*, *Symbolic Correspondence Analysis*).
2. **Encrypted Conversation & Lexicon Export:** Clean export mechanism allowing operators to download transcripts annotated with extracted esoteric keyword arcana and timestamped signal states.
3. **Refined Voice Resonance Mode:** Browser speech synthesis and speech recognition controls supporting custom voice selection, speech rate, pitch adjustment, and interruption-aware playback.
4. **Persistent Alien Profiles:** Database-backed alien profile storage supporting customizable avatar glyph presets, custom glyphs, HTTPS image URLs, and operator bios.
