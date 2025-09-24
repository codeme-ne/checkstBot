import { Pinecone } from '@pinecone-database/pinecone';
import { v4 as uuidv4 } from 'uuid';

if (!process.env.PINECONE_API_KEY) {
  throw new Error('PINECONE_API_KEY is not set in the environment variables');
}

if (!process.env.PINECONE_INDEX) {
  throw new Error('PINECONE_INDEX is not set in the environment variables');
}

export interface DocumentChunk {
  id: string;
  text: string;
  embedding?: number[];
  metadata: {
    source: string;
    page?: number;
    chunkIndex: number;
    timestamp: string;
    documentHash?: string;
  };
}

export interface SearchResult {
  id: string;
  text: string;
  score: number;
  metadata: any;
}

export class VectorDatabase {
  private pinecone: Pinecone;
  private indexName: string;
  private namespace: string;

  constructor(namespace?: string) {
    this.pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY!,
    });
    this.indexName = process.env.PINECONE_INDEX!;
    // Use provided namespace or environment variable or default
    this.namespace = namespace || process.env.PINECONE_NAMESPACE || 'default';

    if (process.env.TEST_MODE === 'true') {
      console.log(`🔬 VectorDB: Using namespace '${this.namespace}' in test mode`);
    }
  }

  /**
   * Initialize the Pinecone index
   */
  async initialize(): Promise<void> {
    try {
      // Check if index exists, create if it doesn't
      const indexList = await this.pinecone.listIndexes();
      const indexExists = indexList.indexes?.some(index => index.name === this.indexName);

      if (!indexExists) {
        await this.pinecone.createIndex({
          name: this.indexName,
          dimension: 1536, // OpenAI ada-002 embedding dimension
          metric: 'cosine',
          spec: {
            serverless: {
              cloud: 'aws',
              region: 'us-east-1'
            }
          }
        });

        // Wait for index to be ready
        await new Promise(resolve => setTimeout(resolve, 60000));
      }
    } catch (error) {
      console.error('Error initializing vector database:', error);
      throw new Error('Failed to initialize vector database');
    }
  }

  /**
   * Store document chunks with embeddings in the vector database
   */
  async storeChunks(chunks: DocumentChunk[]): Promise<void> {
    try {
      const index = this.pinecone.index(this.indexName);

      const vectors = chunks.map(chunk => {
        const metadata: any = {
          text: chunk.text,
          source: chunk.metadata.source,
          chunkIndex: chunk.metadata.chunkIndex,
          timestamp: chunk.metadata.timestamp,
        };
        if (chunk.metadata.page !== undefined) {
          metadata.page = chunk.metadata.page;
        }
        if (chunk.metadata.documentHash) {
          metadata.documentHash = chunk.metadata.documentHash;
        }
        return {
          id: chunk.id || uuidv4(),
          values: chunk.embedding!,
          metadata,
        };
      });

      await index.namespace(this.namespace).upsert(vectors);
    } catch (error) {
      console.error('Error storing chunks:', error);
      throw new Error('Failed to store chunks in vector database');
    }
  }

  /**
   * Search for similar chunks using vector similarity
   */
  async searchSimilar(
    queryEmbedding: number[],
    topK: number = 5,
    filter?: any
  ): Promise<SearchResult[]> {
    try {
      const index = this.pinecone.index(this.indexName);

      const queryResponse = await index.namespace(this.namespace).query({
        vector: queryEmbedding,
        topK,
        includeValues: false,
        includeMetadata: true,
        filter,
      });

      return queryResponse.matches?.map(match => ({
        id: match.id,
        text: match.metadata?.text as string,
        score: match.score || 0,
        metadata: match.metadata,
      })) || [];
    } catch (error) {
      console.error('Error searching vector database:', error);
      throw new Error('Failed to search vector database');
    }
  }

  /**
   * Delete chunks by source document
   */
  async deleteBySource(source: string): Promise<void> {
    try {
      const index = this.pinecone.index(this.indexName);

      await index.namespace(this.namespace).deleteMany({
        filter: { source: { $eq: source } }
      });
    } catch (error) {
      console.error('Error deleting chunks:', error);
      throw new Error('Failed to delete chunks');
    }
  }

  /**
   * Get statistics about the vector database
   */
  async getStats(): Promise<any> {
    try {
      const index = this.pinecone.index(this.indexName);
      return await index.describeIndexStats();
    } catch (error) {
      console.error('Error getting database stats:', error);
      throw new Error('Failed to get database statistics');
    }
  }

  /**
   * Clear all data from the namespace
   */
  async clearAll(): Promise<void> {
    try {
      const index = this.pinecone.index(this.indexName);
      await index.namespace(this.namespace).deleteAll();
    } catch (error: any) {
      // Ignore 404 errors - namespace might not exist or be empty
      if (error.message?.includes('404') || error.status === 404 ||
          error.name === 'PineconeNotFoundError') {
        console.log(`Namespace '${this.namespace}' is already empty or doesn't exist`);
        return;
      }
      console.error('Error clearing database:', error);
      throw new Error('Failed to clear database');
    }
  }

  /**
   * Clear test namespace (utility for testing)
   */
  async clearTestData(): Promise<void> {
    if (this.namespace === 'checkstbot-test' || process.env.TEST_MODE === 'true') {
      await this.clearAll();
      console.log(`✅ Cleared test namespace: ${this.namespace}`);
    } else {
      throw new Error('clearTestData can only be used in test mode');
    }
  }

  /**
   * Get namespace for testing purposes
   */
  getNamespace(): string {
    return this.namespace;
  }
}

export const vectorDB = new VectorDatabase();