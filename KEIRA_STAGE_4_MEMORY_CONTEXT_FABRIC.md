# KEIRA Stage 4 — Memory + Context Fabric

## Scope

This milestone extends durable storage into structured, inspectable memory. Conversation transcripts remain dialogue history; they are not implicitly promoted to durable memory.

## Memory schema

Canonical memory types are distinct:

| Type | Intended use |
|---|---|
| `WORKING_MEMORY` | Current operation or turn-local state. |
| `SESSION_MEMORY` | Explicit state for one authenticated session. |
| `DURABLE_MEMORY` | Explicitly retained operator memory. |
| `USER_AUTHORIZED_PREFERENCE` | Preference explicitly authorized by the operator. |
| `SYSTEM_STATE` | Runtime and operational state produced by the system. |
| `OPERATIONAL_HISTORY` | Auditable history of operations. |
| `EVIDENCE` | Evidence with a source and information state. |
| `PROVENANCE` | Source/accounting metadata. |
| `ADAPTIVE_CONFIGURATION` | Operator-controlled response configuration. |
| `REVOKED_MEMORY` | Historical record retained for revocation/audit but excluded from normal context. |

The canonical `MemoryObject` includes ID, type, content, subject, source, timestamps, provenance type/description/related receipts, information state, confidence, authority, visibility, retention, expiration, revocation status, supersession links, scope, and related receipts.

The database table `keiraMemoryRecords` stores the durable subset. It includes additive columns for subject, provenance type, information state, confidence, visibility, expiration, related receipts, supersession, scope, creation, update, and revocation timestamps.

## Provenance and authority

Supported provenance types are `USER`, `SYSTEM`, `TOOL`, `LOCAL_MODEL`, `EXTERNAL_MODEL`, `FILE`, `DATABASE`, `OBSERVATION`, `VERIFIED_RECORD`, and `INFERENCE`.

Rules enforced before object creation:

- user-authorized preferences require operator authority;
- inferred information cannot be stored as evidence;
- inference provenance cannot be labeled known without verification;
- derived durable memory requires explicit user or verified-record provenance;
- conversation content is not silently converted into durable user memory.

## Lifecycle

Memory supports active, revoked, expired, superseded, and conflicted states. Revocation changes the object to `REVOKED_MEMORY` and excludes it from normal search and context assembly. Expiration applies retention boundaries. Supersession preserves the old record and links it to the replacement. Owner-scoped durable APIs provide read, deterministic search, update, revoke, and bounded receipt history.

## Context pipeline

```text
operator intent
  → deterministic memory filters
  → active/expiry/revocation filter
  → conflict detection
  → relevance scoring
  → minimum necessary context selection
  → context accounting
  → local inference request
  → receipt with supplied memory IDs
```

`assembleMinimumContext()` returns relevant memories, evidence, system state, policies, tools, irrelevant records, unavailable/conflicted information, selected memory IDs, and a bounded context text. It does not dump all memory into the model. Conflict items are excluded and reported as requiring human review.

When Portal local inference is requested, the adaptive response path constructs memory objects from the explicit operator context ledger, assembles a minimum context set, injects only that set, and records exact `memory:<id>` context sources in the inference receipt. The response metadata also exposes `memoryContextIds` for audit.

## Conflict model

Conflicting active items with the same subject and different content produce:

```ts
type MemoryConflict = {
  conflict_id: string;
  items: string[];
  sources: string[];
  timestamps: string[];
  authority: string[];
  resolution_state: "OPEN" | "RESOLVED" | "DISMISSED";
  resolution_method: string | null;
  human_review_required: boolean;
};
```

No winner is silently selected.

## Migration evidence

- `0010_conscious_lilandra.sql` created the durable memory and receipt tables.
- `0011_organic_dragon_lord.sql` adds canonical memory metadata using TiDB-compatible additive SQL; TEXT receipt references are nullable because TiDB rejects TEXT defaults.
- `0012_classy_mikhail_rasputin.sql` adds `updatedAt` for lifecycle tracking.
- The failed temporary TEXT-default generation was normalized out of the migration history; Drizzle generation now reports no schema changes.
- No destructive `DROP` or data-losing `ALTER` operation was used.

## Test and evidence status

| Area | Status | Evidence |
|---|---|---|
| Canonical categories/object | **IMPLEMENTED / VERIFIED** | `memory-fabric.ts` and unit tests. |
| Provenance/authority gates | **IMPLEMENTED / VERIFIED** | Creation rejection tests. |
| Revocation/expiry/supersession | **IMPLEMENTED / VERIFIED** | Lifecycle tests and durable owner-scoped API. |
| Deterministic memory filtering | **IMPLEMENTED / VERIFIED** | Subject/type/provenance/state/scope filters. |
| Conflict detection | **IMPLEMENTED / VERIFIED** | Open conflict with human review required. |
| Minimum-context assembly | **IMPLEMENTED / VERIFIED** | Relevant selection, exclusion, unavailable reporting. |
| Model context accounting | **IMPLEMENTED / VERIFIED BY CONTRACT** | Selected IDs flow into receipt context sources and response metadata. |
| Durable schema | **IMPLEMENTED / VERIFIED** | Migrations applied to project database. |
| Restart persistence | **PARTIAL / NOT CLAIMED** | Durable schema and application path exist; a live authenticated write → process restart → read integration test was not executed in this run. |
| Semantic retrieval | **NOT IMPLEMENTED** | Deterministic filtering precedes any future semantic retrieval. |
| Automatic retention scheduler | **PARTIAL** | Expiration metadata and pure expiration logic exist; scheduler remains future work. |
| Mesh replication | **BLOCKED** | No trusted node authority or replication contract is configured. |

## Limitation statement

KEIRA now has a structured memory fabric and durable storage path. It must not be described as having persistent intelligence until a live authenticated restart test confirms data survives process restart and remains correctly isolated and revocable.
