/**
 * Centralized configuration for the application
 */

// Helper function to mask API keys for logging
function maskApiKey(key: string | undefined): string {
  if (!key) return 'not-set';
  if (key.length < 8) return '***';
  return `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;
}

export const config = {
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    embeddingModel: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
    embeddingDimensions: parseInt(process.env.EMBEDDING_DIMENSIONS || '1536'),
    chatModel: process.env.OPENAI_CHAT_MODEL || 'gpt-4-1106-preview',
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

  // Check required API keys
  if (!config.openai.apiKey) {
    errors.push('OPENAI_API_KEY is not set');
  }

  if (!config.pinecone.apiKey) {
    errors.push('PINECONE_API_KEY is not set');
  }

  if (!config.pinecone.index) {
    errors.push('PINECONE_INDEX is not set');
  }

  // Validate dimensions
  if (config.openai.embeddingDimensions !== 1536) {
    errors.push(`Embedding dimensions (${config.openai.embeddingDimensions}) may not match Pinecone configuration (1536)`);
  }

  // Validate chunk configuration
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
    // Log errors without exposing sensitive data
    const safeErrors = validation.errors.map(error => {
      // Never log actual API keys
      if (error.includes('API_KEY')) {
        return error.replace(/is not set/, 'is missing (check .env.local)');
      }
      return error;
    });

    if (process.env.NODE_ENV === 'production') {
      // In production, don't log configuration errors to console
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
    openai: {
      apiKey: maskApiKey(config.openai.apiKey),
      embeddingModel: config.openai.embeddingModel,
      embeddingDimensions: config.openai.embeddingDimensions,
      chatModel: config.openai.chatModel,
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