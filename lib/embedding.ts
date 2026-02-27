import 'openai/shims/node';
import { OpenAI } from 'openai';

// Configuration
const EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = parseInt(process.env.EMBEDDING_DIMENSIONS || '1536');
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL?.trim();
const EMBEDDING_PROVIDER = (process.env.EMBEDDING_PROVIDER || 'openai').toLowerCase();

// Models that support the dimensions parameter
const MODELS_WITH_DIMENSIONS_SUPPORT = ['text-embedding-3-small', 'text-embedding-3-large'];

/**
 * Check if the current model supports the dimensions parameter
 */
function supportsDimensions(model: string): boolean {
  return MODELS_WITH_DIMENSIONS_SUPPORT.includes(model);
}

export interface EmbeddingResponse {
  embedding: number[];
  text: string;
}

export class EmbeddingService {
  private openai: OpenAI | null = null;

  private normalizeText(text: string): string {
    return text.replace(/\n/g, ' ').trim();
  }

  private generateLocalEmbedding(text: string): number[] {
    const dims = EMBEDDING_DIMENSIONS;
    const vector = new Array(dims).fill(0);
    const tokens = (text.toLowerCase().match(/[a-z0-9]+/g) || ['__empty__']);
    const tokenWeight = 1 / Math.sqrt(tokens.length);

    const hash = (input: string): number => {
      let h = 2166136261;
      for (let i = 0; i < input.length; i++) {
        h ^= input.charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
      return h >>> 0;
    };

    for (const token of tokens) {
      const h1 = hash(token);
      const h2 = hash(`${token}#`);
      const idx = h1 % dims;
      const sign = (h2 & 1) === 0 ? 1 : -1;
      vector[idx] += sign * tokenWeight;
    }

    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    if (magnitude === 0) {
      return vector;
    }
    return vector.map(v => v / magnitude);
  }

  /**
   * Ensure OpenAI client is initialized and environment variables are valid
   */
  private ensureInitialized(): void {
    if (EMBEDDING_PROVIDER === 'local') {
      return; // Local provider requires no client initialization
    }

    if (this.openai) {
      return; // Already initialized
    }

    // Validate API key exists
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not set in environment variables');
    }

    // Validate dimensions
    if (EMBEDDING_DIMENSIONS !== 1536) {
      console.warn(`Warning: Embedding dimensions (${EMBEDDING_DIMENSIONS}) may not match Pinecone index configuration`);
    }

    // Initialize OpenAI client
    // In test environment or Node.js, we need to explicitly allow the client
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: OPENAI_BASE_URL || undefined,
      // Allow usage in test environment (jsdom)
      dangerouslyAllowBrowser: process.env.TEST_MODE === 'true',
    });
  }
  /**
   * Generate embeddings for a text using OpenAI's text-embedding-3-small model with 1536 dimensions
   */
  async generateEmbedding(text: string): Promise<EmbeddingResponse> {
    this.ensureInitialized();

    try {
      // Validate input
      if (typeof text !== 'string') {
        throw new Error('Invalid input: text must be a string');
      }

      const normalizedText = this.normalizeText(text);

      if (EMBEDDING_PROVIDER === 'local') {
        return {
          embedding: this.generateLocalEmbedding(normalizedText),
          text: normalizedText,
        };
      }

      // Build request - only include dimensions for models that support it
      const request: OpenAI.EmbeddingCreateParams = {
        model: EMBEDDING_MODEL,
        input: normalizedText,
      };

      if (supportsDimensions(EMBEDDING_MODEL)) {
        request.dimensions = EMBEDDING_DIMENSIONS;
      }

      const response = await this.openai!.embeddings.create(request);

      // Validate response
      if (!response.data || !response.data[0] || !response.data[0].embedding) {
        throw new Error('Invalid response from OpenAI API');
      }

      const embedding = response.data[0].embedding;

      // Validate embedding dimensions
      if (embedding.length !== EMBEDDING_DIMENSIONS) {
        throw new Error(`Embedding dimension mismatch: expected ${EMBEDDING_DIMENSIONS}, got ${embedding.length}`);
      }

      return {
        embedding,
        text: normalizedText,
      };
    } catch (error: any) {
      console.error('Error generating embedding:', error);

      // Provide more specific error messages
      if (error.status === 429) {
        throw new Error('Rate limit exceeded. Please try again later.');
      } else if (error.status === 401) {
        throw new Error('Invalid API key. Please check your OpenAI API key.');
      } else if (error.message) {
        throw new Error(`Failed to generate embedding: ${error.message}`);
      } else {
        throw new Error('Failed to generate embedding');
      }
    }
  }

  /**
   * Generate embeddings for multiple texts in batch
   */
  async generateEmbeddings(texts: string[]): Promise<EmbeddingResponse[]> {
    this.ensureInitialized();

    try {
      // Validate input
      if (!Array.isArray(texts)) {
        throw new Error('Invalid input: texts must be an array');
      }

      // Return empty array for empty input
      if (texts.length === 0) {
        return [];
      }

      // Normalize all texts
      const normalizedTexts = texts.map(text => {
        if (typeof text !== 'string') {
          throw new Error('Invalid input: all texts must be strings');
        }
        return this.normalizeText(text);
      });

      if (EMBEDDING_PROVIDER === 'local') {
        return normalizedTexts.map(text => ({
          embedding: this.generateLocalEmbedding(text),
          text,
        }));
      }

      // Build request - only include dimensions for models that support it
      const request: OpenAI.EmbeddingCreateParams = {
        model: EMBEDDING_MODEL,
        input: normalizedTexts,
      };

      if (supportsDimensions(EMBEDDING_MODEL)) {
        request.dimensions = EMBEDDING_DIMENSIONS;
      }

      const response = await this.openai!.embeddings.create(request);

      // Validate response
      if (!response.data || response.data.length !== texts.length) {
        throw new Error('Invalid response from OpenAI API: mismatched batch size');
      }

      return response.data.map((item, index) => {
        // Validate each embedding
        if (!item.embedding || item.embedding.length !== EMBEDDING_DIMENSIONS) {
          throw new Error(`Invalid embedding at index ${index}`);
        }

        return {
          embedding: item.embedding,
          text: normalizedTexts[index],
        };
      });
    } catch (error: any) {
      console.error('Error generating embeddings:', error);

      // Provide more specific error messages
      if (error.status === 429) {
        throw new Error('Rate limit exceeded. Please try again later.');
      } else if (error.status === 401) {
        throw new Error('Invalid API key. Please check your OpenAI API key.');
      } else if (error.message) {
        throw new Error(`Failed to generate embeddings: ${error.message}`);
      } else {
        throw new Error('Failed to generate embeddings');
      }
    }
  }

  /**
   * Calculate cosine similarity between two embeddings
   */
  cosineSimilarity(a: number[], b: number[]): number {
    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));

    if (magnitudeA === 0 || magnitudeB === 0) {
      return 0;
    }

    return dotProduct / (magnitudeA * magnitudeB);
  }
}

export const embeddingService = new EmbeddingService();
