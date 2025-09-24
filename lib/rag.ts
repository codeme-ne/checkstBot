import { embeddingService } from './embedding';
import { VectorDatabase, SearchResult } from './vector-db';
import { documentParser } from './document-parser';
import { OpenAI } from 'openai';
import { log } from './logger';
import * as crypto from 'crypto';

// Add production safeguard
if (process.env.NODE_ENV === 'production' && process.env.TEST_MODE === 'true') {
  throw new Error('FATAL: TEST_MODE cannot be enabled in production.');
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  dangerouslyAllowBrowser: process.env.TEST_MODE === 'true',
});

export interface RAGResponse {
  answer: string;
  sources: SearchResult[];
  confidence: number;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export class RAGSystem {
  private vectorDB: VectorDatabase;

  constructor(vectorDB?: VectorDatabase) {
    // Use provided vectorDB or create default instance
    this.vectorDB = vectorDB || new VectorDatabase();
  }

  /**
   * Create an ASCII-safe identifier for storing document chunks
   */
  private createSafeDocumentId(filename: string): string {
    const nameWithoutExtension = filename.replace(/\.[^/.]+$/, '');
    const normalized = nameWithoutExtension
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '');
    const slug = normalized
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    // Keep IDs deterministic but collision-resistant
    const hash = crypto.createHash('sha1').update(filename).digest('hex').slice(0, 8);
    const safeSlug = slug || 'document';

    return `${safeSlug}-${hash}`;
  }

  /**
   * Process and store a document in the RAG system
   */
  async processDocument(
    buffer: Buffer,
    filename: string,
    mimeType: string
  ): Promise<{ success: boolean; message: string; documentId: string; content?: string }> {
    try {
      // Parse the document
      const parsedDoc = await documentParser.parseDocument(buffer, filename, mimeType);

      // Create a safe ASCII-only ID for Pinecone
      const safeDocumentId = this.createSafeDocumentId(filename);

      // Generate embeddings for all chunks
      const chunksWithEmbeddings = await Promise.all(
        parsedDoc.chunks.map(async (chunk) => {
          const embeddingResponse = await embeddingService.generateEmbedding(chunk.text);
          return {
            id: `${safeDocumentId}-${chunk.metadata.chunkIndex}`,
            text: chunk.text,
            embedding: embeddingResponse.embedding,
            metadata: {
              ...chunk.metadata,
              originalFilename: filename, // Store original filename in metadata
            },
          };
        })
      );

      // Store in vector database
      await this.vectorDB.storeChunks(chunksWithEmbeddings);

      // Combine chunks for display content (first 5000 chars)
      const fullContent = parsedDoc.chunks.map(chunk => chunk.text).join('\n\n');

      return {
        success: true,
        message: `Document processed successfully. Created ${chunksWithEmbeddings.length} chunks.`,
        documentId: filename,
        content: fullContent.substring(0, 5000),
      };
    } catch (error) {
      log.error('Error processing document:', { error });
      return {
        success: false,
        message: `Failed to process document: ${error instanceof Error ? error.message : 'Unknown error'}`,
        documentId: '',
      };
    }
  }

  /**
   * Query the RAG system with a user question
   */
  async query(
    question: string,
    chatHistory: ChatMessage[] = [],
    documentId?: string,
    options: {
      maxSources?: number;
      minSimilarity?: number;
      model?: string;
    } = {}
  ): Promise<RAGResponse> {
    const {
      maxSources = 5,
      minSimilarity = 0.5, // Adjusted for text-embedding-3-small
      model = 'gpt-4-1106-preview'
    } = options;

    try {
      // Generate embedding for the question
      const questionEmbedding = await embeddingService.generateEmbedding(question);

      // Create filter for document-specific search if documentId provided
      const filter = documentId ? { source: { $eq: documentId } } : undefined;

      // Search for relevant document chunks
      const searchResults = await this.vectorDB.searchSimilar(
        questionEmbedding.embedding,
        maxSources * 2, // Get more results to filter
        filter
      );

      // Filter results by minimum similarity
      const relevantSources = searchResults.filter(
        result => result.score >= minSimilarity
      ).slice(0, maxSources);

      if (relevantSources.length === 0) {
        console.warn(
          `No relevant sources found for query: "${question}". ` +
          `Initial search returned ${searchResults.length} results. ` +
          `Highest score was ${searchResults.length > 0 ? searchResults[0].score.toFixed(4) : 'N/A'}. ` +
          `Minimum similarity threshold is ${minSimilarity}.`
        );
        return {
          answer: "I couldn't find relevant information in the uploaded documents to answer your question. Please try rephrasing your question or upload more relevant documents.",
          sources: [],
          confidence: 0,
        };
      }

      // Create context from relevant sources
      const context = relevantSources
        .map((source, index) => `[${index + 1}] ${source.text}`)
        .join('\n\n');

      // Generate response using OpenAI
      const systemPrompt = this.createSystemPrompt();
      const userPrompt = this.createUserPrompt(question, context);

      const messages: ChatMessage[] = [
        { role: 'system', content: systemPrompt },
        ...chatHistory.slice(-6), // Include last 3 exchanges for context
        { role: 'user', content: userPrompt },
      ];

      const response = await openai.chat.completions.create({
        model,
        messages,
        temperature: 0.3,
        max_tokens: 1000,
      });

      const answer = response.choices[0]?.message?.content || 'No response generated';
      const confidence = this.calculateConfidence(relevantSources);

      return {
        answer,
        sources: relevantSources,
        confidence,
      };
    } catch (error) {
      log.error('Error querying RAG system:', { error });
      throw new Error('Failed to process query');
    }
  }

  /**
   * Explain a specific text selection from a document
   */
  async explainText(
    selectedText: string,
    context: string = '',
    options: {
      model?: string;
      explanationStyle?: 'simple' | 'detailed' | 'academic';
    } = {}
  ): Promise<string> {
    const { model = 'gpt-4-1106-preview', explanationStyle = 'detailed' } = options;

    try {
      const systemPrompt = this.createExplanationSystemPrompt(explanationStyle);
      const userPrompt = `Please explain this text: "${selectedText}"${context ? `\n\nContext: ${context}` : ''}`;

      const response = await openai.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 500,
      });

      return response.choices[0]?.message?.content || 'No explanation generated';
    } catch (error) {
      log.error('Error explaining text:', { error });
      throw new Error('Failed to explain text');
    }
  }

  /**
   * Generate a summary of uploaded documents
   */
  async summarizeDocuments(
    documentSources: string[] = [],
    summaryType: 'brief' | 'detailed' | 'keypoints' = 'detailed'
  ): Promise<string> {
    try {
      // Get recent chunks from specified documents or all documents
      const embeddingResponse = await embeddingService.generateEmbedding('summary overview main points key concepts');
      const searchResults = await this.vectorDB.searchSimilar(
        // Use a general query embedding to get diverse content
        embeddingResponse.embedding,
        20
      );

      if (searchResults.length === 0) {
        return 'No documents found to summarize.';
      }

      const content = searchResults
        .slice(0, 10) // Limit to avoid token limits
        .map(result => result.text)
        .join('\n\n');

      const systemPrompt = this.createSummarySystemPrompt(summaryType);
      const userPrompt = `Please create a ${summaryType} summary of the following content:\n\n${content}`;

      const response = await openai.chat.completions.create({
        model: 'gpt-4-1106-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 800,
      });

      return response.choices[0]?.message?.content || 'No summary generated';
    } catch (error) {
      log.error('Error generating summary:', { error });
      throw new Error('Failed to generate summary');
    }
  }

  /**
   * Create system prompt for RAG queries
   */
  private createSystemPrompt(): string {
    return `You are a helpful research assistant that answers questions based on provided document context. 

Rules:
1. Use ONLY the information provided in the context to answer questions
2. If information is not in the context, clearly state that
3. Provide structured, educational responses suitable for academic learning
4. Include relevant quotes or references to specific parts of the context
5. Use bullet points or numbered lists when appropriate for clarity
6. If the question requires comparison, organize your response clearly
7. Always maintain an academic and professional tone

Format your responses to be helpful for learning and research purposes.`;
  }

  /**
   * Create user prompt with question and context
   */
  private createUserPrompt(question: string, context: string): string {
    return `Context from documents:
${context}

Question: ${question}

Please provide a comprehensive answer based on the context provided above.`;
  }

  /**
   * Create system prompt for text explanations
   */
  private createExplanationSystemPrompt(style: 'simple' | 'detailed' | 'academic'): string {
    const styleInstructions = {
      simple: 'Explain in simple, easy-to-understand terms suitable for beginners.',
      detailed: 'Provide a thorough explanation with examples and context.',
      academic: 'Use academic language and provide scholarly context and analysis.'
    };

    return `You are an educational assistant that explains text selections. ${styleInstructions[style]} 

Format your explanations to be:
- Clear and well-structured
- Appropriate for learning purposes
- Include relevant examples when helpful
- Break down complex concepts into understandable parts`;
  }

  /**
   * Create system prompt for document summaries
   */
  private createSummarySystemPrompt(type: 'brief' | 'detailed' | 'keypoints'): string {
    const typeInstructions = {
      brief: 'Create a concise 2-3 sentence summary highlighting the main point.',
      detailed: 'Provide a comprehensive summary with key points, main arguments, and important details.',
      keypoints: 'Extract and list the most important key points, concepts, and takeaways in bullet format.'
    };

    return `You are a research assistant that creates document summaries. ${typeInstructions[type]}

Focus on:
- Main themes and arguments
- Key findings or conclusions  
- Important concepts and definitions
- Actionable insights or recommendations

Structure your summary for academic and research purposes.`;
  }

  /**
   * Calculate confidence score based on search results
   */
  private calculateConfidence(sources: SearchResult[]): number {
    if (sources.length === 0) return 0;
    
    const avgScore = sources.reduce((sum, source) => sum + source.score, 0) / sources.length;
    const sourceCount = Math.min(sources.length / 5, 1); // Normalize by expected max sources
    
    return Math.round((avgScore * 0.7 + sourceCount * 0.3) * 100);
  }
}

export const ragSystem = new RAGSystem();
