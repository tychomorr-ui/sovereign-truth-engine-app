# Deprecated: The Portal Bedrock Guide

**Status: REMOVED / LEGACY DOCUMENTATION ONLY**

KEIRA no longer uses Amazon Bedrock for AI inference. This file is retained only as an audit trail for historical repository context and must not be used for deployment.

The active intelligence path is provider-independent:

```text
DETERMINISTIC → LOCAL MODEL → LOCAL TOOLS
```

External AI providers are disabled in the current release. Configure an operator-controlled local OpenAI-compatible runtime only when needed:

```bash
LOCAL_LLM_RUNTIME=ollama
LOCAL_LLM_BASE_URL=http://127.0.0.1:11434/v1
LOCAL_LLM_MODEL=your-installed-model
LOCAL_LLM_API_KEY=
```

Leave the local model variables empty for deterministic offline mode. See [`KEIRA_SOVEREIGN_RUNTIME.md`](./KEIRA_SOVEREIGN_RUNTIME.md) for the active architecture, evidence boundaries, runtime states, receipts, and limitations.

This document contains no active credentials, endpoint configuration, or supported Bedrock deployment procedure.
