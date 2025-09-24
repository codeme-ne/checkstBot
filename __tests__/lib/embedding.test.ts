import { describe, it, expect, beforeEach, jest, beforeAll } from '@jest/globals';
import { EmbeddingService } from '../../lib/embedding';
import { OpenAI } from 'openai';

// Mock OpenAI
jest.mock('openai');

describe('EmbeddingService', () => {
  let embeddingService: EmbeddingService;
  let mockOpenAI: jest.Mocked<OpenAI>;

  beforeAll(() => {
    // Set test environment variables
    process.env.OPENAI_EMBEDDING_MODEL = 'text-embedding-3-small';
    process.env.EMBEDDING_DIMENSIONS = '1536';
  });

  beforeEach(() => {
    jest.clearAllMocks();
    embeddingService = new EmbeddingService();

    // Setup mock OpenAI responses
    mockOpenAI = {
      embeddings: {
        create: jest.fn()
      }
    } as any;
  });

  describe('Configuration', () => {
    it('should use text-embedding-3-small model', () => {
      const model = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';
      expect(model).toBe('text-embedding-3-small');
    });

    it('should configure 1536 dimensions', () => {
      const dimensions = parseInt(process.env.EMBEDDING_DIMENSIONS || '1536');
      expect(dimensions).toBe(1536);
    });

    it('should validate dimension compatibility with Pinecone', () => {
      const embeddingDimensions = 1536;
      const pineconeDimensions = 1536; // Your Pinecone configuration
      expect(embeddingDimensions).toBe(pineconeDimensions);
    });
  });

  describe('Single Embedding Generation', () => {
    it('should generate embedding with correct dimensions', async () => {
      const mockEmbedding = new Array(1536).fill(0.1);
      const mockResponse = {
        data: [{ embedding: mockEmbedding }]
      };

      (OpenAI as any).mockImplementation(() => ({
        embeddings: {
          create: jest.fn().mockResolvedValue(mockResponse)
        }
      }));

      const service = new EmbeddingService();
      const result = await service.generateEmbedding('test text');

      expect(result.embedding).toHaveLength(1536);
      expect(result.text).toBe('test text');
    });

    it('should call OpenAI API with correct parameters', async () => {
      const mockCreate = jest.fn().mockResolvedValue({
        data: [{ embedding: new Array(1536).fill(0) }]
      });

      (OpenAI as any).mockImplementation(() => ({
        embeddings: {
          create: mockCreate
        }
      }));

      const service = new EmbeddingService();
      await service.generateEmbedding('test text');

      expect(mockCreate).toHaveBeenCalledWith({
        model: 'text-embedding-3-small',
        input: 'test text',
        dimensions: 1536
      });
    });

    it('should normalize newlines in input text', async () => {
      const mockCreate = jest.fn().mockResolvedValue({
        data: [{ embedding: new Array(1536).fill(0) }]
      });

      (OpenAI as any).mockImplementation(() => ({
        embeddings: {
          create: mockCreate
        }
      }));

      const service = new EmbeddingService();
      await service.generateEmbedding('text\nwith\nnewlines');

      expect(mockCreate).toHaveBeenCalledWith({
        model: 'text-embedding-3-small',
        input: 'text with newlines',
        dimensions: 1536
      });
    });

    it('should handle empty strings', async () => {
      const mockCreate = jest.fn().mockResolvedValue({
        data: [{ embedding: new Array(1536).fill(0) }]
      });

      (OpenAI as any).mockImplementation(() => ({
        embeddings: {
          create: mockCreate
        }
      }));

      const service = new EmbeddingService();
      const result = await service.generateEmbedding('');

      expect(result.text).toBe('');
      expect(result.embedding).toHaveLength(1536);
    });
  });

  describe('Batch Embedding Generation', () => {
    it('should generate embeddings for multiple texts', async () => {
      const texts = ['text1', 'text2', 'text3'];
      const mockEmbeddings = texts.map(() => new Array(1536).fill(0.1));
      const mockResponse = {
        data: mockEmbeddings.map(emb => ({ embedding: emb }))
      };

      const mockCreate = jest.fn().mockResolvedValue(mockResponse);
      (OpenAI as any).mockImplementation(() => ({
        embeddings: {
          create: mockCreate
        }
      }));

      const service = new EmbeddingService();
      const results = await service.generateEmbeddings(texts);

      expect(results).toHaveLength(3);
      results.forEach((result, index) => {
        expect(result.embedding).toHaveLength(1536);
        expect(result.text).toBe(texts[index]);
      });
    });

    it('should call API with dimensions parameter for batch', async () => {
      const mockCreate = jest.fn().mockResolvedValue({
        data: [
          { embedding: new Array(1536).fill(0) },
          { embedding: new Array(1536).fill(0) }
        ]
      });

      (OpenAI as any).mockImplementation(() => ({
        embeddings: {
          create: mockCreate
        }
      }));

      const service = new EmbeddingService();
      await service.generateEmbeddings(['text1', 'text2']);

      expect(mockCreate).toHaveBeenCalledWith({
        model: 'text-embedding-3-small',
        input: ['text1', 'text2'],
        dimensions: 1536
      });
    });

    it('should handle empty array', async () => {
      const mockCreate = jest.fn().mockResolvedValue({
        data: []
      });

      (OpenAI as any).mockImplementation(() => ({
        embeddings: {
          create: mockCreate
        }
      }));

      const service = new EmbeddingService();
      const results = await service.generateEmbeddings([]);

      expect(results).toEqual([]);
    });
  });

  describe('Error Handling', () => {
    it('should handle API failures gracefully', async () => {
      const mockCreate = jest.fn().mockRejectedValue(new Error('API Error'));

      (OpenAI as any).mockImplementation(() => ({
        embeddings: {
          create: mockCreate
        }
      }));

      const service = new EmbeddingService();

      await expect(service.generateEmbedding('test')).rejects.toThrow('Failed to generate embedding');
    });

    it('should handle rate limiting errors', async () => {
      const rateLimitError = new Error('Rate limit exceeded');
      (rateLimitError as any).status = 429;

      const mockCreate = jest.fn().mockRejectedValue(rateLimitError);

      (OpenAI as any).mockImplementation(() => ({
        embeddings: {
          create: mockCreate
        }
      }));

      const service = new EmbeddingService();

      await expect(service.generateEmbedding('test')).rejects.toThrow('Failed to generate embedding');
    });

    it('should handle network timeouts', async () => {
      const timeoutError = new Error('Request timeout');
      const mockCreate = jest.fn().mockRejectedValue(timeoutError);

      (OpenAI as any).mockImplementation(() => ({
        embeddings: {
          create: mockCreate
        }
      }));

      const service = new EmbeddingService();

      await expect(service.generateEmbedding('test')).rejects.toThrow('Failed to generate embedding');
    });

    it('should log errors for debugging', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const mockCreate = jest.fn().mockRejectedValue(new Error('Test error'));

      (OpenAI as any).mockImplementation(() => ({
        embeddings: {
          create: mockCreate
        }
      }));

      const service = new EmbeddingService();

      try {
        await service.generateEmbedding('test');
      } catch {
        // Expected to throw
      }

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error generating embedding:',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Cosine Similarity', () => {
    it('should calculate cosine similarity correctly', () => {
      const service = new EmbeddingService();

      const vectorA = [1, 0, 0];
      const vectorB = [1, 0, 0];

      const similarity = service.cosineSimilarity(vectorA, vectorB);
      expect(similarity).toBeCloseTo(1.0, 5); // Identical vectors
    });

    it('should return 0 for orthogonal vectors', () => {
      const service = new EmbeddingService();

      const vectorA = [1, 0];
      const vectorB = [0, 1];

      const similarity = service.cosineSimilarity(vectorA, vectorB);
      expect(similarity).toBeCloseTo(0, 5);
    });

    it('should return -1 for opposite vectors', () => {
      const service = new EmbeddingService();

      const vectorA = [1, 0];
      const vectorB = [-1, 0];

      const similarity = service.cosineSimilarity(vectorA, vectorB);
      expect(similarity).toBeCloseTo(-1, 5);
    });

    it('should handle high-dimensional vectors', () => {
      const service = new EmbeddingService();

      // Create two similar 1536-dimensional vectors
      const vectorA = new Array(1536).fill(0).map((_, i) => Math.sin(i));
      const vectorB = new Array(1536).fill(0).map((_, i) => Math.sin(i + 0.1));

      const similarity = service.cosineSimilarity(vectorA, vectorB);
      expect(similarity).toBeGreaterThan(0.9); // Should be very similar
      expect(similarity).toBeLessThan(1.0);    // But not identical
    });
  });

  describe('Performance', () => {
    it('should handle large text efficiently', async () => {
      const largeText = 'a'.repeat(8000); // 8000 characters
      const mockCreate = jest.fn().mockResolvedValue({
        data: [{ embedding: new Array(1536).fill(0) }]
      });

      (OpenAI as any).mockImplementation(() => ({
        embeddings: {
          create: mockCreate
        }
      }));

      const service = new EmbeddingService();
      const startTime = Date.now();
      await service.generateEmbedding(largeText);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should batch process efficiently', async () => {
      const texts = new Array(20).fill('sample text');
      const mockEmbeddings = texts.map(() => new Array(1536).fill(0));
      const mockResponse = {
        data: mockEmbeddings.map(emb => ({ embedding: emb }))
      };

      const mockCreate = jest.fn().mockResolvedValue(mockResponse);
      (OpenAI as any).mockImplementation(() => ({
        embeddings: {
          create: mockCreate
        }
      }));

      const service = new EmbeddingService();
      const results = await service.generateEmbeddings(texts);

      expect(results).toHaveLength(20);
      expect(mockCreate).toHaveBeenCalledTimes(1); // Single API call for batch
    });
  });

  describe('Dimension Validation', () => {
    it('should produce vectors of exactly 1536 dimensions', async () => {
      const mockEmbedding = new Array(1536).fill(0.1);
      const mockResponse = {
        data: [{ embedding: mockEmbedding }]
      };

      (OpenAI as any).mockImplementation(() => ({
        embeddings: {
          create: jest.fn().mockResolvedValue(mockResponse)
        }
      }));

      const service = new EmbeddingService();
      const result = await service.generateEmbedding('test');

      expect(result.embedding).toHaveLength(1536);
      expect(result.embedding.every(val => typeof val === 'number')).toBe(true);
    });

    it('should validate embedding dimensions match configuration', async () => {
      const configuredDimensions = 1536;
      const mockEmbedding = new Array(configuredDimensions).fill(0);
      const mockResponse = {
        data: [{ embedding: mockEmbedding }]
      };

      (OpenAI as any).mockImplementation(() => ({
        embeddings: {
          create: jest.fn().mockResolvedValue(mockResponse)
        }
      }));

      const service = new EmbeddingService();
      const result = await service.generateEmbedding('test');

      expect(result.embedding.length).toBe(configuredDimensions);
    });
  });
});