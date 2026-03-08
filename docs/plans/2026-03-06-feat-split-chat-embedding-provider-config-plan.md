---
title: "feat: Split chat and embedding provider configuration"
type: feat
status: completed
date: 2026-03-06
---

# Split Chat and Embedding Provider Configuration

## Overview

Currently both chat completions and embedding generation share a single `OPENAI_API_KEY` + `OPENAI_BASE_URL`. This forces both services through the same provider (e.g. OpenRouter), even when the user wants native OpenAI for embeddings and OpenRouter/Groq for chat. This plan introduces separate env vars for the embedding service with sensible fallbacks for backward compatibility.

## Problem Statement

The user's `.env.local` points `OPENAI_BASE_URL` at OpenRouter and uses an OpenRouter API key. This works for chat but creates problems for embeddings:

1. **Model name mismatch**: OpenRouter uses `openai/text-embedding-3-small` while native OpenAI uses `text-embedding-3-small`
2. **No way to use different keys**: Some providers (Groq) don't support embedding models at all, requiring the `EMBEDDING_PROVIDER=local` workaround
3. **Single point of failure**: If the chat provider has issues, embeddings also fail

## Proposed Solution

Add three new env vars for the embedding service, each with a fallback chain:

| New Env Var | Fallback | Default |
|---|---|---|
| `EMBEDDING_API_KEY` | `OPENAI_API_KEY` | (required) |
| `EMBEDDING_BASE_URL` | `https://api.openai.com/v1` (NOT `OPENAI_BASE_URL`) | `https://api.openai.com/v1` |
| `EMBEDDING_MODEL` | `OPENAI_EMBEDDING_MODEL` | `text-embedding-3-small` |

### Critical Design Decision: EMBEDDING_BASE_URL Fallback

When `EMBEDDING_API_KEY` is explicitly set, `EMBEDDING_BASE_URL` does **NOT** inherit from `OPENAI_BASE_URL`. It defaults to the standard OpenAI endpoint. This prevents the dangerous scenario where a native OpenAI key gets sent to OpenRouter.

Fallback logic:
```
EMBEDDING_BASE_URL is set?        -> use it
EMBEDDING_API_KEY is set?         -> default to https://api.openai.com/v1
Neither set?                      -> fall back to OPENAI_BASE_URL (same provider for both)
```

### Precedence: EMBEDDING_PROVIDER=local

`EMBEDDING_PROVIDER=local` takes absolute precedence. When active, `EMBEDDING_API_KEY`, `EMBEDDING_BASE_URL`, and `EMBEDDING_MODEL` are all ignored. No OpenAI client is created for embeddings.

## Technical Approach

### Phase 1: Centralize Config (activate dead code)

`lib/config.ts` already exists with a proper config structure but nothing imports it. Activate it as the single source of truth.

**Files to modify:**

#### `lib/config.ts`

Add embedding-specific config with fallback chain:

```typescript
embedding: {
  provider: process.env.EMBEDDING_PROVIDER || 'openai',
  apiKey: process.env.EMBEDDING_API_KEY || process.env.OPENAI_API_KEY,
  baseUrl: resolveEmbeddingBaseUrl(),
  model: process.env.EMBEDDING_MODEL || process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
  dimensions: parseInt(process.env.EMBEDDING_DIMENSIONS || '1536'),
},
chat: {
  apiKey: process.env.OPENAI_API_KEY,
  baseUrl: process.env.OPENAI_BASE_URL?.trim() || undefined,
  model: process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini',
}
```

Where `resolveEmbeddingBaseUrl()` implements the critical fallback:

```typescript
function resolveEmbeddingBaseUrl(): string | undefined {
  if (process.env.EMBEDDING_BASE_URL?.trim()) {
    return process.env.EMBEDDING_BASE_URL.trim();
  }
  if (process.env.EMBEDDING_API_KEY) {
    // Explicit embedding key set -> default to OpenAI, NOT OPENAI_BASE_URL
    return 'https://api.openai.com/v1';
  }
  // No embedding-specific config -> inherit from chat config
  return process.env.OPENAI_BASE_URL?.trim() || undefined;
}
```

Update `validateConfig()` and `getSafeConfig()` to handle the new vars.

### Phase 2: Wire up consumers

#### `lib/embedding.ts`

- Import config from `lib/config.ts`
- Replace direct `process.env` reads at module scope (lines 5-8)
- In `ensureInitialized()` (lines 75-91): use `config.embedding.apiKey` and `config.embedding.baseUrl`
- Update error message: reference `EMBEDDING_API_KEY` or `OPENAI_API_KEY` depending on which is configured

#### `lib/rag.ts`

- Import config from `lib/config.ts`
- Replace direct `process.env` reads at module scope (lines 9-16)
- In `ensureInitialized()` (lines 74-82): use `config.chat.apiKey` and `config.chat.baseUrl`
- Keep `EMBEDDING_PROVIDER` / threshold logic unchanged (already works)

### Phase 3: Documentation and Validation

#### `.env.example`

Add new vars with comments:

```env
# --- Chat Provider (required) ---
OPENAI_API_KEY=sk-your-key
OPENAI_BASE_URL=                          # Optional: OpenRouter, Groq, etc.
OPENAI_CHAT_MODEL=gpt-4o-mini

# --- Embedding Provider (optional, falls back to chat provider) ---
# EMBEDDING_API_KEY=sk-your-openai-key    # Separate key for embeddings
# EMBEDDING_BASE_URL=                      # Defaults to api.openai.com when EMBEDDING_API_KEY is set
# EMBEDDING_MODEL=text-embedding-3-small   # Model name for embedding provider
EMBEDDING_DIMENSIONS=1536
EMBEDDING_PROVIDER=openai                  # 'openai' or 'local'
```

#### `scripts/pre-deploy-check.js`

Add optional validation for `EMBEDDING_API_KEY` (warn if missing and `OPENAI_BASE_URL` points to a non-OpenAI provider).

#### `jest.env.js`

Add `EMBEDDING_API_KEY` and `EMBEDDING_BASE_URL` test defaults.

#### Error messages in `lib/embedding.ts`

```typescript
// Before
throw new Error('OPENAI_API_KEY is not set in environment variables');

// After
const keySource = config.embedding.apiKey === process.env.EMBEDDING_API_KEY
  ? 'EMBEDDING_API_KEY'
  : 'OPENAI_API_KEY';
throw new Error(`${keySource} is not set in environment variables`);
```

## Configuration Examples

### Native OpenAI for everything (unchanged)
```env
OPENAI_API_KEY=sk-proj-...
OPENAI_CHAT_MODEL=gpt-4o-mini
```

### OpenRouter for chat, native OpenAI for embeddings
```env
OPENAI_API_KEY=sk-or-v1-...
OPENAI_BASE_URL=https://openrouter.ai/api/v1
OPENAI_CHAT_MODEL=openai/gpt-4o-mini

EMBEDDING_API_KEY=sk-proj-...
EMBEDDING_MODEL=text-embedding-3-small
```

### Groq for chat, local embeddings (existing pattern, unchanged)
```env
OPENAI_API_KEY=gsk_...
OPENAI_BASE_URL=https://api.groq.com/openai/v1
OPENAI_CHAT_MODEL=llama-3.1-8b-instant
EMBEDDING_PROVIDER=local
```

## Acceptance Criteria

- [x] Setting only `OPENAI_API_KEY` works exactly as before (backward compatible)
- [x] Setting `EMBEDDING_API_KEY` routes embeddings through a separate provider
- [x] `EMBEDDING_BASE_URL` defaults to `api.openai.com` when `EMBEDDING_API_KEY` is set (not `OPENAI_BASE_URL`)
- [x] `EMBEDDING_MODEL` overrides `OPENAI_EMBEDDING_MODEL` for the embedding client
- [x] `EMBEDDING_PROVIDER=local` takes absolute precedence over any embedding API vars
- [x] Error messages reference the correct env var name
- [x] `lib/config.ts` is the single source of truth (no more direct `process.env` reads in rag.ts/embedding.ts)
- [x] `.env.example` documents all new vars
- [x] Existing tests pass without changes (backward compatibility)

## Files to Change

| File | Change |
|---|---|
| `lib/config.ts` | Add embedding/chat split config with fallback chain |
| `lib/embedding.ts` | Import from config, use embedding-specific credentials |
| `lib/rag.ts` | Import from config, use chat-specific credentials |
| `.env.example` | Document new vars |
| `jest.env.js` | Add test defaults for new vars |
| `scripts/pre-deploy-check.js` | Optional validation for split config |
| `__tests__/config/environment.test.ts` | Test new config fallback chains |
| `__tests__/lib/embedding.test.ts` | Verify embedding client uses correct credentials |

## Risks

- **Dimension mismatch**: If `EMBEDDING_MODEL` produces different dimensions than the Pinecone index expects. Mitigated by `EMBEDDING_DIMENSIONS` validation in config.
- **Module-scope caching**: Env vars are read at import time. Changing `.env.local` requires server restart. This is existing behavior and acceptable.

## Sources

- Existing Groq integration: commits `57f6a39`, `7ac9df4`
- `lib/config.ts` centralized config structure (currently unused)
- `lib/embedding.ts:86-91` and `lib/rag.ts:78-82` for current client instantiation
