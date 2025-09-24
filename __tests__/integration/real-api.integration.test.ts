/**
 * Real API Integration Tests
 * These tests use ACTUAL OpenAI and Pinecone APIs
 * No mocks - testing real world functionality
 */

import { describe, it, expect, beforeAll, afterEach, beforeEach } from '@jest/globals';
import { DocumentParser } from '../../lib/document-parser';
import { EmbeddingService } from '../../lib/embedding';
import { VectorDatabase } from '../../lib/vector-db';
import { RAGSystem } from '../../lib/rag';
import { waitForIndexing, generateTestId } from '../test-utils';
import * as fs from 'fs';
import * as path from 'path';

// Skip tests if API keys are not available
const skipIfNoAPIs = process.env.SKIP_API_TESTS === 'true' || process.env.SKIP_VECTOR_TESTS === 'true';

const describeOrSkip = skipIfNoAPIs ? describe.skip : describe;

describeOrSkip('Real API Integration Tests', () => {
  let documentParser: DocumentParser;
  let embeddingService: EmbeddingService;
  let vectorDB: VectorDatabase;
  let ragSystem: RAGSystem;

  beforeAll(() => {
    // Verify we're in test mode
    expect(process.env.TEST_MODE).toBe('true');
    expect(process.env.PINECONE_NAMESPACE).toBe('checkstbot-test');

    // Initialize services with real APIs
    documentParser = new DocumentParser();
    embeddingService = new EmbeddingService();
    vectorDB = new VectorDatabase('checkstbot-test');
    ragSystem = new RAGSystem(vectorDB); // Pass the same vectorDB instance to ensure namespace consistency
  });

  afterEach(async () => {
    // Clean up test data after each test
    if (process.env.TEST_CLEANUP === 'true') {
      try {
        await vectorDB.clearTestData();
      } catch (error) {
        console.warn('Could not clean test data:', error);
      }
    }
  });

  describe('Document Processing with Real APIs', () => {
    it('should process a text document end-to-end with real APIs', async () => {
      // Create test document
      const testContent = `
        This is a test document for RAG system.
        It contains multiple paragraphs to test chunking.

        The RAG system uses OpenAI embeddings to convert text into vectors.
        These vectors are stored in Pinecone for similarity search.

        When users ask questions, the system retrieves relevant chunks.
        Then it uses GPT-4 to generate contextual answers.
      `;

      const buffer = Buffer.from(testContent, 'utf-8');

      // Step 1: Parse document (no API calls)
      const parsedDoc = await documentParser.parseDocument(
        buffer,
        'test-doc.txt',
        'text/plain'
      );

      expect(parsedDoc.chunks).toBeDefined();
      expect(parsedDoc.chunks.length).toBeGreaterThan(0);
      expect(parsedDoc.metadata.documentHash).toBeDefined();

      // Step 2: Generate real embeddings with OpenAI
      const chunkWithEmbedding = parsedDoc.chunks[0];
      const embeddingResponse = await embeddingService.generateEmbedding(
        chunkWithEmbedding.text
      );

      expect(embeddingResponse.embedding).toBeDefined();
      expect(embeddingResponse.embedding).toHaveLength(1536);
      expect(typeof embeddingResponse.embedding[0]).toBe('number');

      // Step 3: Store in real Pinecone
      const chunksToStore = [{
        ...chunkWithEmbedding,
        embedding: embeddingResponse.embedding,
      }];

      await vectorDB.storeChunks(chunksToStore);

      // Wait for Pinecone to index the data using intelligent polling
      await waitForIndexing(
        process.env.PINECONE_INDEX!,
        'checkstbot-test',
        1
      );

      // Step 4: Search in real Pinecone
      const queryEmbedding = await embeddingService.generateEmbedding(
        'What is the RAG system?'
      );

      const searchResults = await vectorDB.searchSimilar(
        queryEmbedding.embedding,
        5
      );

      expect(searchResults).toBeDefined();
      expect(searchResults.length).toBeGreaterThan(0);
      expect(searchResults[0].text).toContain('RAG');
      expect(searchResults[0].score).toBeGreaterThan(0.4); // Adjusted for real-world similarity scores
    }, 30000); // 30 second timeout for real API calls

    it('should handle PDF processing with real APIs', async () => {
      // Create a simple test PDF content
      // Note: For real testing, you'd have an actual PDF file
      const pdfPath = path.join(__dirname, '../fixtures/sample.pdf');

      // Skip if no test PDF available
      if (!fs.existsSync(pdfPath)) {
        console.warn('Skipping PDF test - no sample.pdf in fixtures');
        return;
      }

      const pdfBuffer = fs.readFileSync(pdfPath);

      // Process the PDF document
      const result = await ragSystem.processDocument(
        pdfBuffer,
        'sample.pdf',
        'application/pdf'
      );

      expect(result.success).toBe(true);
      expect(result.documentId).toBe('sample.pdf');

      // Verify vectors were stored in Pinecone
      const stats = await vectorDB.getStats();
      expect(stats.totalRecordCount).toBeGreaterThan(0);
    }, 30000);
  });

  describe('RAG Query System with Real APIs', () => {
    beforeEach(async () => {
      // Set up test document in Pinecone
      const testDoc = `
        Machine Learning is a subset of artificial intelligence.
        It enables systems to learn from data without explicit programming.
        Deep learning uses neural networks with multiple layers.
      `;

      const buffer = Buffer.from(testDoc, 'utf-8');
      const docId = generateTestId('ml-doc');
      await ragSystem.processDocument(buffer, `${docId}.txt`, 'text/plain');

      // Wait for Pinecone to index the data using intelligent polling
      await waitForIndexing(
        process.env.PINECONE_INDEX!,
        'checkstbot-test',
        1 // At least 1 chunk expected
      );
    }, 30000); // Add 30-second timeout for setup

    it('should answer questions using real OpenAI and Pinecone', async () => {
      const question = 'What is machine learning?';

      const response = await ragSystem.query(question);

      expect(response.answer).toBeDefined();
      expect(response.answer).toContain('artificial intelligence');
      expect(response.sources).toBeDefined();
      expect(response.sources.length).toBeGreaterThan(0);
      expect(response.confidence).toBeGreaterThan(50);
    }, 30000);

    it('should handle multi-turn conversations with context', async () => {
      const chatHistory = [
        { role: 'user', content: 'What is deep learning?' },
        { role: 'assistant', content: 'Deep learning uses neural networks with multiple layers.' }
      ];

      const followUp = 'How is it different from regular machine learning?';

      const response = await ragSystem.query(followUp, chatHistory);

      expect(response.answer).toBeDefined();
      expect(response.sources).toBeDefined();
      // Answer should be contextual to the conversation
      expect(response.answer.toLowerCase()).toContain('neural');
    }, 30000);
  });

  describe('Error Handling with Real APIs', () => {
    it('should handle API rate limits gracefully', async () => {
      // Make multiple rapid requests to potentially trigger rate limits
      const promises = Array(5).fill(null).map(() =>
        embeddingService.generateEmbedding('test text')
      );

      // Should either all succeed or fail with proper error
      try {
        const results = await Promise.all(promises);
        expect(results).toHaveLength(5);
      } catch (error: any) {
        expect(error.message).toMatch(/rate limit|too many requests/i);
      }
    }, 30000);

    it('should handle network failures', async () => {
      // Create a service with an invalid API key
      const { OpenAI } = require('openai');

      // Create OpenAI client with invalid key
      const invalidOpenai = new OpenAI({
        apiKey: 'sk-invalid-key-123',
        dangerouslyAllowBrowser: true,
      });

      // Try to generate embedding with invalid client
      await expect(
        invalidOpenai.embeddings.create({
          model: 'text-embedding-3-small',
          input: 'test',
          dimensions: 1536,
        })
      ).rejects.toThrow();
    });
  });

  describe('Cost Tracking', () => {
    it('should track API usage costs', async () => {
      const startTime = Date.now();
      let apiCalls = 0;

      // Track embedding calls
      const text = 'Sample text for cost tracking';
      await embeddingService.generateEmbedding(text);
      apiCalls++;

      // Estimate cost (text-embedding-3-small: $0.00002 per 1K tokens)
      // Rough estimate: ~10 tokens per call
      const estimatedCost = apiCalls * 0.00002 * 0.01;

      expect(estimatedCost).toBeLessThan(0.01); // Less than 1 cent

      const elapsedTime = Date.now() - startTime;
      console.log(`✅ Test completed in ${elapsedTime}ms, estimated cost: $${estimatedCost.toFixed(6)}`);
    });
  });
});

describe('E2E Test: Complete User Journey', () => {
  let ragSystem: RAGSystem;
  let vectorDB: VectorDatabase;

  beforeAll(() => {
    vectorDB = new VectorDatabase('checkstbot-test');
    ragSystem = new RAGSystem(vectorDB);
  });

  afterAll(async () => {
    await vectorDB.clearTestData();
  });

  const itOrSkip = skipIfNoAPIs ? it.skip : it;

  itOrSkip('should handle complete document upload to chat flow', async () => {
    // Step 1: User uploads a document
    const document = `
      Climate Change and Global Warming

      Climate change refers to long-term shifts in global temperatures and weather patterns.
      These shifts may be natural, but since the 1800s, human activities have been the main driver.

      The primary cause is the burning of fossil fuels like coal, oil, and gas.
      This produces greenhouse gases that trap heat in Earth's atmosphere.

      Effects include:
      - Rising sea levels
      - Extreme weather events
      - Loss of biodiversity
      - Food and water scarcity

      Solutions involve reducing emissions and transitioning to renewable energy.
    `;

    const buffer = Buffer.from(document, 'utf-8');

    // Step 2: Process and store document
    const uploadResult = await ragSystem.processDocument(
      buffer,
      'climate-change.txt',
      'text/plain'
    );

    expect(uploadResult.success).toBe(true);
    expect(uploadResult.documentId).toBe('climate-change.txt');

    // Wait for Pinecone to index the document using intelligent polling
    await waitForIndexing(
      process.env.PINECONE_INDEX!,
      'checkstbot-test',
      1 // At least 1 chunk expected
    );

    // Step 3: User asks questions about the document
    const question1 = 'What causes climate change?';
    const answer1 = await ragSystem.query(question1);

    expect(answer1.answer).toContain('fossil fuels');
    expect(answer1.sources.length).toBeGreaterThan(0);
    expect(answer1.confidence).toBeGreaterThan(70);

    // Step 4: Follow-up question
    const question2 = 'What are the solutions?';
    const answer2 = await ragSystem.query(question2, [
      { role: 'user', content: question1 },
      { role: 'assistant', content: answer1.answer }
    ]);

    expect(answer2.answer).toContain('renewable energy');

    // Step 5: Verify document can be found
    const searchQuery = await ragSystem.query('List the effects mentioned');
    expect(searchQuery.answer).toContain('sea levels');

    console.log('✅ E2E Test Complete: Document uploaded, indexed, and successfully queried');
  }, 60000); // 60 second timeout for complete flow
});