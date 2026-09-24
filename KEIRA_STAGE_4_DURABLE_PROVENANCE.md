# KEIRA Stage 4 — Durable Memory and Provenance

## Objective

Stage 4 moves operator-authorized memory and intelligence receipts from process-local state into durable, user-scoped database records. The design preserves the existing authority boundary: persistence records what happened; it does not make a claim true, authorize an action, or elevate generated text to verified knowledge.

## Durable tables

### `keiraMemoryRecords`

Stores explicit memory records with:

- stable UUID;
- owning `userId`;
- memory class;
- content;
- source and provenance;
- authority, sensitivity, and retention metadata;
- revocation flag and timestamp;
- creation timestamp.

### `keiraIntelligenceReceipts`

Stores durable receipts with:

- receipt ID and owning user;
- operation, intelligence mode, provider, and model;
- serialized context sources;
- external-service and data-locality flags;
- policy and verification text;
- result state, including `GENERATED_INFERENCE`;
- creation timestamp.

## API surface

The protected Portal router exposes:

- `getDurableMemory({ memoryClass? })`;
- `writeDurableMemory(...)`;
- `revokeDurableMemory({ id })`;
- `getDurableReceipts({ limit })`;
- `getLocalModelStatus()` from Stage 3.

All reads and mutations are constrained by the authenticated operator’s `userId`. Revocation updates only a record matching both ID and owner; a foreign or missing ID performs no mutation.

Completed Portal inference now persists its receipt before returning the response. This makes provider, model, context sources, locality, verification language, result state, and operation traceable after process restart.

## Migration

Generated migration: `drizzle/0010_conscious_lilandra.sql`.

The migration was reviewed and contains only two `CREATE TABLE` statements. No `DROP`, destructive `ALTER`, or data rewrite was generated. The reviewed SQL was applied to the project database successfully.

## Evidence status

| Area | Status | Evidence |
|---|---|---|
| Durable memory schema | **IMPLEMENTED / VERIFIED** | Schema and migration create `keiraMemoryRecords`. |
| Durable receipt schema | **IMPLEMENTED / VERIFIED** | Schema and migration create `keiraIntelligenceReceipts`. |
| User isolation | **IMPLEMENTED / VERIFIED BY CONTRACT** | Every read/write/revoke query includes authenticated user ownership. |
| Revocation | **IMPLEMENTED / VERIFIED BY CONTRACT** | Revocation is owner-scoped and active reads exclude revoked rows. |
| Receipt persistence from Portal inference | **IMPLEMENTED** | `sendMessage` writes the returned receipt before response completion. |
| Receipt result-state integrity | **IMPLEMENTED / VERIFIED** | Generated model output remains `GENERATED_INFERENCE`; deterministic output remains distinct. |
| Database migration | **VERIFIED** | Migration generated, reviewed, and applied successfully. |
| Persistence integration tests against live DB | **PARTIAL** | Typecheck and contract tests pass; live user-scoped CRUD requires an authenticated database integration fixture. |
| Encryption at rest | **UNVERIFIED** | Depends on the deployment database/storage configuration; application schema does not claim encryption. |
| Retention scheduler | **PARTIAL** | Retention metadata is durable; automated expiration is not yet scheduled. |
| Cross-node replication | **BLOCKED** | No trusted mesh authority or replication contract is configured. |

## Boundary statement

Durability is not truth. A durable receipt proves that KEIRA recorded an operation and its declared status. It does not prove the content was correct. A durable memory record remains operator-controlled data with explicit provenance and revocation state.
