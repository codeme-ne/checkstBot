/**
 * Centralized configuration for the application.
 *
 * This is the single source of truth for all environment-based settings.
 * Both lib/rag.ts and lib/embedding.ts import from here — do NOT read
 * process.env directly in consumer modules.
 */

// Helper function to mask API keys for logging
function maskApiKey(key: string | undefined): string {
  if (!key) return 'not-set';
  if (key.length < 8) return '***';
  return `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;
}

/**
 * Resolve the base URL for the embedding client.
 *
 * Critical fallback logic:
 *  1. EMBEDDING_BASE_URL explicitly set            -> use it
 *  2. EMBEDDING_API_KEY set (but no base URL)      -> default to OpenAI
 *     (prevents sending a native OpenAI key to OpenRouter by accident)
 *  3. Neither set                                  -> inherit OPENAI_BASE_URL
 */
function resolveEmbeddingBaseUrl(): string | undefined {
  const explicit = process.env.EMBEDDING_BASE_URL?.trim();
  if (explicit) {
    return explicit;
  }
  if (process.env.EMBEDDING_API_KEY) {
    return 'https://api.openai.com/v1';
  }
  return process.env.OPENAI_BASE_URL?.trim() || undefined;
}

export const config = {
  chat: {
    apiKey: process.env.OPENAI_API_KEY,
    baseUrl: process.env.OPENAI_BASE_URL?.trim() || undefined,
    model: process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini',
  },
  embedding: {
    provider: (process.env.EMBEDDING_PROVIDER || 'openai').toLowerCase(),
    apiKey: process.env.EMBEDDING_API_KEY || process.env.OPENAI_API_KEY,
    baseUrl: resolveEmbeddingBaseUrl(),
    model: process.env.EMBEDDING_MODEL || process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
    dimensions: parseInt(process.env.EMBEDDING_DIMENSIONS || '1536'),
  },
  pinecone: {
    apiKey: process.env.PINECONE_API_KEY,
    environment: process.env.PINECONE_ENVIRONMENT || 'us-east-1',
    index: process.env.PINECONE_INDEX,
  },
  chunking: {
    size: parseInt(process.env.CHUNK_SIZE || '1000'),
    overlap: parseInt(process.env.CHUNK_OVERLAP || '200'),
  },
  app: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760'), // 10MB default
    appUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  },
};

/**
 * Validate required configuration
 */
export function validateConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!config.chat.apiKey) {
    errors.push('OPENAI_API_KEY is not set');
  }

  // Embedding key is only required when provider is not local
  if (config.embedding.provider !== 'local' && !config.embedding.apiKey) {
    const keyName = process.env.EMBEDDING_API_KEY ? 'EMBEDDING_API_KEY' : 'OPENAI_API_KEY';
    errors.push(`${keyName} is not set (required for embedding provider "${config.embedding.provider}")`);
  }

  if (!config.pinecone.apiKey) {
    errors.push('PINECONE_API_KEY is not set');
  }

  if (!config.pinecone.index) {
    errors.push('PINECONE_INDEX is not set');
  }

  if (config.embedding.dimensions !== 1536) {
    errors.push(`Embedding dimensions (${config.embedding.dimensions}) may not match Pinecone configuration (1536)`);
  }

  if (config.chunking.size <= 0) {
    errors.push('CHUNK_SIZE must be greater than 0');
  }

  if (config.chunking.overlap < 0) {
    errors.push('CHUNK_OVERLAP must be non-negative');
  }

  if (config.chunking.overlap >= config.chunking.size) {
    errors.push('CHUNK_OVERLAP must be less than CHUNK_SIZE');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get configuration with validation
 */
export function getConfig() {
  const validation = validateConfig();

  if (!validation.valid && process.env.NODE_ENV !== 'test') {
    const safeErrors = validation.errors.map(error => {
      if (error.includes('API_KEY')) {
        return error.replace(/is not set/, 'is missing (check .env.local)');
      }
      return error;
    });

    if (process.env.NODE_ENV === 'production') {
      throw new Error('Configuration error. Check server logs.');
    } else {
      console.error('Configuration validation failed:', safeErrors);
      throw new Error('Invalid configuration: ' + safeErrors.join(', '));
    }
  }

  return config;
}

/**
 * Get safe configuration for logging (with masked API keys)
 */
export function getSafeConfig() {
  return {
    chat: {
      apiKey: maskApiKey(config.chat.apiKey),
      baseUrl: config.chat.baseUrl || '(default: api.openai.com)',
      model: config.chat.model,
    },
    embedding: {
      provider: config.embedding.provider,
      apiKey: maskApiKey(config.embedding.apiKey),
      baseUrl: config.embedding.baseUrl || '(default: api.openai.com)',
      model: config.embedding.model,
      dimensions: config.embedding.dimensions,
    },
    pinecone: {
      apiKey: maskApiKey(config.pinecone.apiKey),
      environment: config.pinecone.environment,
      index: config.pinecone.index,
    },
    chunking: config.chunking,
    app: config.app,
  };
}
