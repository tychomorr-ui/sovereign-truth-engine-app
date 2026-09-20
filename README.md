# KEIRA — Sovereign Intelligence Node

KEIRA is the sovereign ecosystem's dedicated conversational intelligence node. It provides direct, long-context dialogue, adaptive persona manifestation, esoteric keyword awareness, secure first-party sessions, optional browser voice interaction, encrypted transcript export, and a self-hosted local inference path with a deterministic offline fallback.

KEIRA is intentionally distinct from its sibling systems: Tesseract-A provides the mirror and recovery entity experience, including the KEIRA$KHAOS mode; Root provides sovereign identity; XinUS Clarity provides practical public-service workflows; and Cosmic Net / Tesseract Terminus provides the network and universal-truth console.

## Runtime Architecture

The production request path is self-hosted. KEIRA uses Express and tRPC for its application API, a MySQL-compatible database for application data, and an operator-controlled OpenAI-compatible local model endpoint when configured. If no local model is available, the application uses a bounded deterministic responder rather than silently calling a remote service or pretending that a model is active. First-party email/password and owner-bootstrap sessions use signed HTTP-only cookies. Nginx provides the public reverse proxy, and PM2 supervises the production Node process.

| Component | Production responsibility |
|---|---|
| React + Vite | Conversation-first operator interface |
| Express + tRPC | Authenticated application API |
| Local model endpoint | Optional self-hosted inference via an OpenAI-compatible `/v1/chat/completions` API |
| Deterministic runtime | Always-available bounded fallback when no local model endpoint is configured |
| MySQL-compatible database | User, profile, conversation, and learning data |
| Optional object storage | Transcript object storage and presigned downloads when configured |
| Nginx + PM2 | HTTPS ingress and process supervision |

## Core Capabilities

KEIRA retains a coherent conversation history, adapts its response framing to the operator's stated preferences, highlights configured esoteric terms, supports browser speech input and synthesis where the browser provides those capabilities, exports conversation transcripts, and shows generation calibration stages without fabricating operational telemetry.

The application uses the existing internal `portal.chat.*` tRPC namespace for backward-compatible API contracts. That internal namespace is not the public product name and does not change the KEIRA interface or deployment identity.

## Sovereign Runtime Contract

KEIRA is the intelligence system; a Llama-family model or other local model is only an interchangeable inference capability. The canonical local path is:

`NEXINUS → KEIRA → APEX CANONICAL → SOVEREIGN INTELLIGENCE BUS → deterministic engine / local model runtime / local tools / reflection / memory / provenance`

The capability resolver explicitly represents deterministic, local-model, local-tool, trusted-mesh, and external-provider lanes. The current release enables deterministic operation, enables local-model operation only when configured, reserves trusted mesh, and disables external providers. It never silently falls through to a remote provider.

Every intelligence operation returns a receipt containing the operation, mode, provider, model, context sources, locality, policy, verification, and result state. The Interface panel reports factual states such as `MODEL_READY`, `MODEL_NOT_CONFIGURED`, `MODEL_UNAVAILABLE`, `DETERMINISTIC READY`, `EXTERNAL PROVIDERS DISABLED`, and `OFFLINE MODE AVAILABLE`.

The deterministic lane provides normalization, lexical classification, contradiction detection, bounded planning, policy evaluation, state comparison, and consistency-oriented primitives without model inference. Reflection is separate from generation and uses a hard recursion limit. Sovereign memory is explicit and locally controlled, with authority, sensitivity, retention, provenance, and revocation metadata.

### Local model configuration

The local gateway speaks the common OpenAI-compatible `/v1/chat/completions` and `/v1/models` shapes. This permits Ollama, llama.cpp server, vLLM, or another local-compatible runtime without changing KEIRA's memory, identity, policy, orchestration, or API contracts:

```bash
LOCAL_LLM_RUNTIME=ollama
LOCAL_LLM_BASE_URL=http://127.0.0.1:11434/v1
LOCAL_LLM_MODEL=your-installed-model
LOCAL_LLM_API_KEY=
```

Leave `LOCAL_LLM_BASE_URL` and `LOCAL_LLM_MODEL` empty for deterministic offline mode. No external AI provider is required.

## Local Development

Install Node.js 22 and pnpm, then install the committed dependency graph and start the development server.

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Run the verification gates before committing changes:

```bash
pnpm check
pnpm test
pnpm build
```

## Self-Hosted Deployment

The dedicated repository is [`tychomorr-ui/keira`](https://github.com/tychomorr-ui/keira). The audited Lightsail sequence, required environment variables, PM2 process configuration, Nginx reverse proxy, and TLS setup are documented in [LIGHTSAIL_DEPLOYMENT_GUIDE.md](./LIGHTSAIL_DEPLOYMENT_GUIDE.md). The source and endpoint audit is documented in [SECURITY_AUDIT.md](./SECURITY_AUDIT.md).

Set `LOCAL_LLM_BASE_URL` and `LOCAL_LLM_MODEL` to enable a local model such as Ollama, llama.cpp, or vLLM. Leave both empty to use deterministic mode. `LOCAL_LLM_API_KEY` is optional and is sent only to the configured local endpoint.

Do not commit `.env` files, local model API keys, database passwords, owner keys, or signing secrets.

## License

MIT. See [LICENSE](./LICENSE) when present.
