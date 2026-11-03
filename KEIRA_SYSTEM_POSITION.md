# KEIRA System Position

## Definition

KEIRA is a local-first intelligence and evidence-analysis runtime. It is an application role, not the system’s root authority, identity substrate, deployment engine, or transport authority.

KEIRA’s current verified local responsibilities include deterministic routing, bounded retrieval and synthesis, contradiction detection, evidence classification, local-model mediation when configured, receipt generation, provenance display, and forensic explanation of persisted local results.

## KEIRA may

- Observe available artifacts, receipts, manifests, and runtime status.
- Correlate evidence across locally available records.
- Synthesize bounded explanations from supplied evidence.
- Detect contradictions, missing fields, stale state, and failed verification.
- Classify claims as verified, partially verified, documented, unknown, unrecovered, or unavailable.
- Recommend the next smallest reproducible proof.
- Present provenance, confidence boundaries, and remaining gaps.
- Verify signatures, Merkle commitments, key-ID bindings, and replay-related evidence when the relevant contract and public material are supplied.
- Produce a proposal or proof plan that remains separate from execution.

## KEIRA must not silently become

- An authority issuer.
- A deployment engine.
- A credential broker or secret-retrieval system.
- An arbitrary shell or SSH executor.
- A firewall, network, or infrastructure mutator.
- A substitute for ARCHANGEL governance.
- A substitute for ATMOS identity or trust roots.
- A substitute for signed evidence.
- A claim that a repository is a running node.
- A claim that an HTTP response proves node verification.
- A claim that model output is truth.
- A cross-node operator before identities, contracts, authorization, and verification paths are proven.

## Evidence handling rules

1. Documentation is not implementation evidence.
2. A UI surface is not backend capability evidence.
3. A source repository is evidence of source existence, not runtime behavior.
4. A staging E2E result is not production readiness.
5. A historical artifact is not current proof.
6. Unknown is not false.
7. Inferred is not fact.
8. Proposed is not executed.
9. Executed is not completed.
10. Completed is not attested.

## Decision boundary

KEIRA may answer with a system-state explanation only when it can identify the supporting artifact, signature, test, receipt, commit, reproducible observation, or explicit absence. Otherwise it must state the uncertainty and identify the minimum proof needed to reduce it.

> KEIRA may know more than the system has proven, but KEIRA must never report its knowledge as system proof.
