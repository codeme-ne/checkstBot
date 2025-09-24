// Load environment variables for testing
try {
  require('dotenv').config({ path: '.env.local' });
} catch (e) {
  // dotenv not available in test environment
}

// Polyfill fetch for Node.js test environment
// Required for OpenAI and Pinecone SDKs
if (typeof globalThis.fetch === 'undefined') {
  const nodeFetch = require('node-fetch');
  globalThis.fetch = nodeFetch;
  globalThis.Headers = nodeFetch.Headers;
  globalThis.Request = nodeFetch.Request;
  globalThis.Response = nodeFetch.Response;
}

// Configure test environment for REAL API testing
// We're using real APIs with test namespaces/prefixes

// Use real API keys from .env.local
// If not available, tests will skip (not fail with fake keys)
if (!process.env.OPENAI_API_KEY) {
  console.warn('⚠️  OPENAI_API_KEY not set - API tests will be skipped');
  process.env.SKIP_API_TESTS = 'true';
}

if (!process.env.PINECONE_API_KEY) {
  console.warn('⚠️  PINECONE_API_KEY not set - Vector DB tests will be skipped');
  process.env.SKIP_VECTOR_TESTS = 'true';
}

// Set test-specific configurations
process.env.PINECONE_NAMESPACE = 'checkstbot-test'; // Use test namespace
process.env.TEST_MODE = 'true';
process.env.OPENAI_EMBEDDING_MODEL = 'text-embedding-3-small';
process.env.EMBEDDING_DIMENSIONS = '1536';
process.env.CHUNK_SIZE = '1000';
process.env.CHUNK_OVERLAP = '200';

// Test budget tracking (optional)
process.env.OPENAI_TEST_BUDGET = '5.00'; // $5 monthly budget for tests
process.env.TEST_CLEANUP = 'true'; // Clean up after tests

console.log('🧪 Test Mode: Using REAL APIs with test namespace:', process.env.PINECONE_NAMESPACE);