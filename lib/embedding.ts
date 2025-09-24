import 'openai/shims/node';
import { OpenAI } from 'openai';

// Validate API key exists
if (!process.env.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY is not set in environment variables');
}

// Initialize OpenAI client
// In test environment or Node.js, we need to explicitly allow the client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  // Allow usage in test environment (jsdom)
  dangerouslyAllowBrowser: process.env.TEST_MODE === 'true',
});

// Configuration
const EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-ada-002';
const EMBEDDING_DIMENSIONS = parseInt(process.env.EMBEDDING_DIMENSIONS || '1536');

// Validate dimensions
if (EMBEDDING_DIMENSIONS !== 1536) {
  console.warn(`Warning: Embedding dimensions (${EMBEDDING_DIMENSIONS}) may not match Pinecone index configuration`);
}

export interface EmbeddingResponse {
  embedding: number[];
  text: string;
}

export class EmbeddingService {
  /**
   * Generate embeddings for a text using OpenAI's text-embedding-3-small model with 1536 dimensions
   */
  async generateEmbedding(text: string): Promise<EmbeddingResponse> {
    try {
      // Validate input
      if (typeof text !== 'string') {
        throw new Error('Invalid input: text must be a string');
      }

      // Trim and normalize text (allow empty strings for edge cases)
      const normalizedText = text.replace(/\n/g, ' ').trim();

      const response = await openai.embeddings.create({
        model: EMBEDDING_MODEL,
        input: normalizedText,
        dimensions: EMBEDDING_DIMENSIONS,
      });

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
        return text.replace(/\n/g, ' ').trim();
      });

      const response = await openai.embeddings.create({
        model: EMBEDDING_MODEL,
        input: normalizedTexts,
        dimensions: EMBEDDING_DIMENSIONS,
      });

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
    
    return dotProduct / (magnitudeA * magnitudeB);
  }
}

export const embeddingService = new EmbeddingService();