import { Pinecone } from '@pinecone-database/pinecone';

/**
 * Utility functions for testing with real APIs
 */

/**
 * Waits for Pinecone to index vectors by polling the index stats
 * Uses a dual approach: first checks stats, then performs a test query
 * @param indexName The name of the Pinecone index
 * @param namespace The namespace within the index
 * @param expectedCount The minimum number of vectors expected
 * @param timeout Maximum time to wait in milliseconds (default: 15000)
 * @returns Promise that resolves when vectors are indexed or rejects on timeout
 */
export async function waitForIndexing(
  indexName: string,
  namespace: string,
  expectedCount: number,
  timeout = 15000
): Promise<void> {
  const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY!,
  });

  const index = pinecone.index(indexName);
  const startTime = Date.now();
  let pollInterval = 500; // Start with 500ms

  while (Date.now() - startTime < timeout) {
    try {
      // First check stats
      const stats = await index.describeIndexStats();
      const namespaceStats = stats.namespaces?.[namespace];

      if (namespaceStats && namespaceStats.vectorCount >= expectedCount) {
        // Stats show vectors, now do a test query to confirm they're searchable
        try {
          const testQuery = await index.namespace(namespace).query({
            vector: new Array(1536).fill(0.01), // Dummy vector
            topK: 1,
            includeMetadata: false,
          });

          if (testQuery.matches && testQuery.matches.length > 0) {
            console.log(`✅ Namespace ${namespace} has ${namespaceStats.vectorCount} searchable vectors`);
            return;
          }
        } catch (queryError) {
          console.warn('Vectors indexed but not yet searchable, continuing to wait...');
        }
      }

      // Exponential backoff: increase interval up to 2 seconds
      pollInterval = Math.min(pollInterval * 1.5, 2000);
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    } catch (error) {
      console.warn('Error checking index:', error);
      // Continue polling even if there's an error
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
  }

  throw new Error(`Timeout waiting for namespace ${namespace} to have ${expectedCount} searchable vectors after ${timeout}ms`);
}

/**
 * Generates a unique test ID with timestamp
 * Useful for ensuring test isolation
 */
export function generateTestId(prefix: string): string {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000);
  return `${prefix}-${timestamp}-${random}`;
}

/**
 * Sleep utility for testing
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}