#!/usr/bin/env node

/**
 * Script to clear the Pinecone test namespace
 * Run this after changing embedding models to remove incompatible vectors
 */

require('dotenv').config({ path: '.env.local' });
const { Pinecone } = require('@pinecone-database/pinecone');

async function clearTestNamespace() {
  console.log('🧹 Clearing Pinecone test namespace...');

  try {
    const pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY,
    });

    const indexName = process.env.PINECONE_INDEX;
    const namespace = 'checkstbot-test';

    console.log(`Index: ${indexName}`);
    console.log(`Namespace: ${namespace}`);

    const index = pinecone.index(indexName);

    // Delete all vectors in the test namespace
    await index.namespace(namespace).deleteAll();

    console.log('✅ Test namespace cleared successfully');
  } catch (error) {
    if (error.message?.includes('404') || error.status === 404) {
      console.log('✅ Namespace was already empty or doesn\'t exist');
    } else {
      console.error('❌ Error clearing namespace:', error.message);
      process.exit(1);
    }
  }
}

clearTestNamespace();