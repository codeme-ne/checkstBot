import { describe, it, expect, beforeEach } from '@jest/globals';

describe('Environment Configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Required Environment Variables', () => {
    it('should have OPENAI_API_KEY defined', () => {
      expect(process.env.OPENAI_API_KEY).toBeDefined();
      expect(process.env.OPENAI_API_KEY).not.toBe('');
    });

    it('should have valid OpenAI API key format', () => {
      const apiKey = process.env.OPENAI_API_KEY;
      // Support both old format (sk-xxx) and new project format (sk-proj-xxx)
      expect(apiKey).toMatch(/^sk-(proj-)?[A-Za-z0-9_-]{20,}$/);
    });

    it('should have PINECONE_API_KEY defined', () => {
      expect(process.env.PINECONE_API_KEY).toBeDefined();
      expect(process.env.PINECONE_API_KEY).not.toBe('');
    });

    it('should have PINECONE_INDEX defined', () => {
      expect(process.env.PINECONE_INDEX).toBeDefined();
      expect(process.env.PINECONE_INDEX).not.toBe('');
    });
  });

  describe('Embedding Configuration', () => {
    it('should use text-embedding-3-small model', () => {
      const embeddingModel = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';
      expect(embeddingModel).toBe('text-embedding-3-small');
    });

    it('should have embedding dimensions set to 1536', () => {
      const dimensions = process.env.EMBEDDING_DIMENSIONS || '1536';
      expect(parseInt(dimensions)).toBe(1536);
    });

    it('should match Pinecone index dimensions', () => {
      const embeddingDimensions = parseInt(process.env.EMBEDDING_DIMENSIONS || '1536');
      const pineconeDimensions = 1536; // Expected Pinecone configuration
      expect(embeddingDimensions).toBe(pineconeDimensions);
    });
  });

  describe('Chunking Configuration', () => {
    it('should have appropriate chunk size', () => {
      const chunkSize = parseInt(process.env.CHUNK_SIZE || '1000');
      expect(chunkSize).toBeGreaterThan(500);
      expect(chunkSize).toBeLessThanOrEqual(2000);
    });

    it('should have appropriate chunk overlap', () => {
      const chunkOverlap = parseInt(process.env.CHUNK_OVERLAP || '200');
      const chunkSize = parseInt(process.env.CHUNK_SIZE || '1000');
      expect(chunkOverlap).toBeGreaterThan(0);
      expect(chunkOverlap).toBeLessThan(chunkSize / 2);
    });
  });
});

describe('Configuration Validation', () => {
  it('should not expose sensitive keys in error messages', () => {
    const validateConfig = () => {
      const errors: string[] = [];

      if (!process.env.OPENAI_API_KEY) {
        errors.push('OPENAI_API_KEY is missing');
      }

      if (!process.env.PINECONE_API_KEY) {
        errors.push('PINECONE_API_KEY is missing');
      }

      return errors;
    };

    const errors = validateConfig();
    errors.forEach(error => {
      expect(error).not.toContain('sk-');
      expect(error).not.toContain(process.env.OPENAI_API_KEY);
      expect(error).not.toContain(process.env.PINECONE_API_KEY);
    });
  });

  it('should validate all required configuration on startup', () => {
    const config = {
      openai: {
        apiKey: process.env.OPENAI_API_KEY,
        embeddingModel: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
        embeddingDimensions: parseInt(process.env.EMBEDDING_DIMENSIONS || '1536'),
      },
      pinecone: {
        apiKey: process.env.PINECONE_API_KEY,
        index: process.env.PINECONE_INDEX,
      },
      chunking: {
        size: parseInt(process.env.CHUNK_SIZE || '1000'),
        overlap: parseInt(process.env.CHUNK_OVERLAP || '200'),
      },
    };

    expect(config.openai.apiKey).toBeDefined();
    expect(config.openai.embeddingModel).toBe('text-embedding-3-small');
    expect(config.openai.embeddingDimensions).toBe(1536);
    expect(config.pinecone.apiKey).toBeDefined();
    expect(config.pinecone.index).toBeDefined();
    expect(config.chunking.size).toBe(1000);
    expect(config.chunking.overlap).toBe(200);
  });
});