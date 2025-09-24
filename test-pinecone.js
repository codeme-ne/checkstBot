require('dotenv').config({ path: '.env.local' });
const { Pinecone } = require('@pinecone-database/pinecone');

async function testPinecone() {
  console.log('Testing Pinecone connection...');
  console.log('API Key exists:', !!process.env.PINECONE_API_KEY);
  console.log('Index name:', process.env.PINECONE_INDEX);

  try {
    const pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY,
    });

    console.log('Pinecone client created');

    // List indexes
    const indexes = await pinecone.listIndexes();
    console.log('Available indexes:', indexes);

    // Check if our index exists
    const indexName = process.env.PINECONE_INDEX || 'checkstbot-index';
    const indexExists = indexes.indexes?.some(idx => idx.name === indexName);

    if (!indexExists) {
      console.log(`Index "${indexName}" does not exist!`);
      console.log('Creating index...');

      await pinecone.createIndex({
        name: indexName,
        dimension: 1536,
        metric: 'cosine',
        spec: {
          serverless: {
            cloud: 'aws',
            region: 'us-east-1'
          }
        }
      });

      console.log('Index created successfully!');
    } else {
      console.log(`Index "${indexName}" exists`);

      const index = pinecone.index(indexName);
      const stats = await index.describeIndexStats();
      console.log('Index stats:', stats);
    }

  } catch (error) {
    console.error('Pinecone error:', error);
  }
}

testPinecone();