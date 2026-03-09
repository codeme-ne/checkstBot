import { embeddingService } from './embedding';
import { VectorDatabase, SearchResult } from './vector-db';
import { documentParser } from './document-parser';
import { OpenAI } from 'openai';
import { log } from './logger';
import { config } from './config';
import * as crypto from 'crypto';

// Grounding Configuration — provider sourced from centralized config
const USING_LOCAL_EMBEDDINGS = config.embedding.provider === 'local';
const RELEVANCE_THRESHOLD = USING_LOCAL_EMBEDDINGS ? 0.5 : 0.65;
const MIN_TOP_SCORE = USING_LOCAL_EMBEDDINGS ? 0.45 : 0.6;
const MIN_EXPLANATION_CONTEXT_SIMILARITY = 0.35;
const DOCUMENT_FILTER_FALLBACK_SOURCES = USING_LOCAL_EMBEDDINGS ? 3 : 2;
const DOCUMENT_SEARCH_RETRY_DELAYS_MS = [150, 300];
const DEFAULT_CHAT_MODEL = config.chat.model;

// Add production safeguard
if (process.env.NODE_ENV === 'production' && process.env.TEST_MODE === 'true') {
  throw new Error('FATAL: TEST_MODE cannot be enabled in production.');
}

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
  private openai: OpenAI | null = null;

  constructor(vectorDB?: VectorDatabase) {
    // Use provided vectorDB or create default instance
    this.vectorDB = vectorDB || new VectorDatabase();
  }

  private async wait(ms: number): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, ms));
  }

  private looksTruncatedSelection(text: string): boolean {
    const trimmed = text.trim();
    if (trimmed.length < 8) return false;

    const endsWithEllipsis = /(\.\.\.|…)\s*$/.test(trimmed);
    const openParens = (trimmed.match(/\(/g) || []).length;
    const closeParens = (trimmed.match(/\)/g) || []).length;
    const unmatchedParens = openParens > closeParens;
    const quoteCount = (trimmed.match(/"/g) || []).length;
    const unmatchedQuotes = quoteCount % 2 === 1;

    const hasTerminalPunctuation = /[.!?]["')\]]?\s*$/.test(trimmed);
    const words = trimmed.split(/\s+/);
    const lastWord = words[words.length - 1] || '';
    const suspiciousShortEnding = !hasTerminalPunctuation && words.length > 6 && lastWord.length <= 2;

    return endsWithEllipsis || unmatchedParens || unmatchedQuotes || suspiciousShortEnding;
  }

  /**
   * Ensure OpenAI client is initialized
   */
  private ensureInitialized(): void {
    if (this.openai) {
      return; // Already initialized
    }

    if (!config.chat.apiKey) {
      throw new Error('OPENAI_API_KEY is not set in environment variables');
    }

    this.openai = new OpenAI({
      apiKey: config.chat.apiKey,
      baseURL: config.chat.baseUrl,
      dangerouslyAllowBrowser: process.env.TEST_MODE === 'true',
    });
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

      // Combine all chunks for complete document display
      const fullContent = parsedDoc.chunks.map(chunk => chunk.text).join('\n\n');

      return {
        success: true,
        message: `Document processed successfully. Created ${chunksWithEmbeddings.length} chunks.`,
        documentId: filename,
        content: fullContent,  // Return complete content, not truncated
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

  async hasDocuments(): Promise<boolean> {
    return this.vectorDB.hasDocuments();
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
    this.ensureInitialized();

    const {
      maxSources = 5,
      minSimilarity = RELEVANCE_THRESHOLD, // Configured relevance threshold
      model = DEFAULT_CHAT_MODEL
    } = options;

    try {
      // Questions about the selected document name do not need vector retrieval.
      if (documentId && this.isDocumentNameQuestion(question)) {
        return {
          answer: `Das aktuell ausgewählte Dokument heißt "${documentId}".`,
          sources: [],
          confidence: 100,
        };
      }

      // Generate embedding for the question
      const questionEmbedding = await embeddingService.generateEmbedding(question);

      // Create filter for document-specific search if documentId provided
      const filter = documentId ? { source: { $eq: documentId } } : undefined;

      // Search for relevant document chunks
      let searchResults = await this.vectorDB.searchSimilar(
        questionEmbedding.embedding,
        maxSources * 2, // Get more results to filter
        filter
      );

      // Pinecone can be briefly eventually-consistent right after upsert.
      if (documentId && searchResults.length === 0) {
        for (const delay of DOCUMENT_SEARCH_RETRY_DELAYS_MS) {
          await this.wait(delay);
          const retryResults = await this.vectorDB.searchSimilar(
            questionEmbedding.embedding,
            maxSources * 2,
            filter
          );
          if (retryResults.length > 0) {
            searchResults = retryResults;
            break;
          }
        }
      }

      // Filter results by minimum similarity
      let relevantSources = searchResults.filter(
        result => result.score >= minSimilarity
      ).slice(0, maxSources);
      let usedDocumentFallback = false;

      // With document-specific queries we still want useful answers for generic prompts
      // like "was ist in dem dokument?" even when lexical overlap is weak.
      if (relevantSources.length === 0 && documentId && searchResults.length > 0) {
        relevantSources = searchResults
          .slice(0, Math.min(maxSources, DOCUMENT_FILTER_FALLBACK_SOURCES));
        usedDocumentFallback = true;
      }

      // After filtering by minSimilarity, add this check:
      if (!usedDocumentFallback &&
          relevantSources.length > 0 &&
          relevantSources[0].score < MIN_TOP_SCORE) {
        console.warn(
          `Top match score ${relevantSources[0].score.toFixed(3)} below threshold ${MIN_TOP_SCORE}`
        );
        return {
          answer: "Die hochgeladenen Dokumente enthalten keine ausreichend relevanten Informationen zu dieser Frage. Bitte formulieren Sie Ihre Frage um oder laden Sie weitere relevante Dokumente hoch.",
          sources: [],
          confidence: 0,
        };
      }

      if (relevantSources.length === 0) {
        console.warn(
          `No relevant sources found for query: "${question}". ` +
          `Initial search returned ${searchResults.length} results. ` +
          `Highest score was ${searchResults.length > 0 ? searchResults[0].score.toFixed(4) : 'N/A'}. ` +
          `Minimum similarity threshold is ${minSimilarity}.`
        );
        return {
          answer: "Ich konnte in den hochgeladenen Dokumenten keine relevanten Informationen finden, um Ihre Frage zu beantworten. Bitte versuchen Sie, Ihre Frage umzuformulieren oder laden Sie weitere relevante Dokumente hoch.",
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
      const userPrompt = this.createUserPrompt(question, context, documentId, relevantSources);

      const messages: ChatMessage[] = [
        { role: 'system', content: systemPrompt },
        ...chatHistory.slice(-6), // Include last 3 exchanges for context
        { role: 'user', content: userPrompt },
      ];

      const response = await this.openai!.chat.completions.create({
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
      const reason = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to process query: ${reason}`);
    }
  }

  private isDocumentNameQuestion(question: string): boolean {
    const normalized = question.toLowerCase().trim();
    const patterns = [
      /wie\s+hei(?:ss|s|ß)t.*dokument/,
      /name.*dokument/,
      /what(?:'s| is)\s+the\s+name\s+of\s+the\s+document/,
      /document\s+name/,
    ];

    return patterns.some(pattern => pattern.test(normalized));
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
      documentId?: string;
    } = {}
  ): Promise<string> {
    this.ensureInitialized();

    const { model = DEFAULT_CHAT_MODEL, explanationStyle = 'detailed', documentId } = options;

    try {
      const systemPrompt = this.createExplanationSystemPrompt(explanationStyle);
      const isTruncatedSelection = this.looksTruncatedSelection(selectedText);
      const retrievedContext = await this.retrieveExplanationContext(selectedText, documentId);
      const hasAdditionalContext = Boolean(context.trim() || retrievedContext.trim());
      const truncatedHint = isTruncatedSelection && !hasAdditionalContext
        ? '\nHinweis vom System: Der Zitat-Ausschnitt wirkt abgeschnitten und es liegt kaum zusätzlicher Kontext vor.'
        : isTruncatedSelection
          ? '\nHinweis vom System: Der Zitat-Ausschnitt wirkt abgeschnitten. Nutze den bereitgestellten Dokumentkontext, um ihn vorsichtig einzuordnen.'
          : '';
      const userPrompt = `Bitte erkläre das folgende Zitat hilfreich und klar.

Markierte Stelle:
"""
${selectedText}
"""

${context ? `Lokaler Kontext aus dem Dokument:\n"""\n${context}\n"""` : ''}

${retrievedContext ? `Semantisch gefundener Dokumentkontext:\n${retrievedContext}` : ''}

${documentId ? `Dokument: ${documentId}` : ''}
${truncatedHint}

Wichtig:
- Antworte in derselben Sprache wie das Zitat.
- Erkläre zuerst die Kernaussage der markierten Stelle.
- Nutze danach den Dokumentkontext, um Begriffe, Ziel oder Einordnung zu präzisieren.
- Wenn der Ausschnitt erkennbar abgeschnitten ist, erwähne das nur knapp und leite dann direkt in die Erklärung über.
- Wenn wichtige Informationen im Kontext fehlen, benenne konkret, was offen bleibt.
- Gib eine praktische, direkt nutzbare Einordnung.`;

      const response = await this.openai!.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.2,
        max_tokens: 700,
      });

      return response.choices[0]?.message?.content || 'No explanation generated';
    } catch (error) {
      log.error('Error explaining text:', { error });
      const reason = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to explain text: ${reason}`);
    }
  }

  /**
   * Generate a summary of uploaded documents
   */
  async summarizeDocuments(
    documentSources: string[] = [],
    summaryType: 'brief' | 'detailed' | 'keypoints' = 'detailed'
  ): Promise<string> {
    this.ensureInitialized();

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

      const response = await this.openai!.chat.completions.create({
        model: DEFAULT_CHAT_MODEL,
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
   * Create system prompt for RAG queries (document-only grounding)
   */
  private createSystemPrompt(): string {
    return `Du bist ein Lernassistent und antwortest nur auf Basis des bereitgestellten Dokumentkontexts.

Regeln:
1. Verwende einfache, klare Sprache.
2. Maximal drei kurze Sätze.
3. Wenn Informationen fehlen, sage das direkt ohne zu spekulieren.
4. Nutze kein externes Wissen außerhalb des Kontexts.`;
  }

  /**
   * Create user prompt with question and context
   */
  private createUserPrompt(
    question: string,
    context: string,
    documentId?: string,
    sources: SearchResult[] = []
  ): string {
    const documentSources = Array.from(
      new Set(sources.map(source => source.metadata?.source).filter(Boolean))
    );
    const sourceList = documentSources.length > 0
      ? documentSources.join(', ')
      : 'nicht angegeben';

    return `Context from documents:
${context}

Selected document ID: ${documentId || 'nicht angegeben'}
Document sources in context: ${sourceList}

Question: ${question}

Please provide a comprehensive answer based on the context provided above.`;
  }

  /**
   * Create system prompt for text explanations
   */
  private createExplanationSystemPrompt(style: 'simple' | 'detailed' | 'academic'): string {
    const styleInstructions = {
      simple: 'Halte es sehr verständlich, klar gegliedert und auf das Wesentliche fokussiert.',
      detailed: 'Erkläre präzise, praxisnah, gut strukturiert und mit dokumentbezogener Einordnung.',
      academic: 'Erkläre fachlich präzise, dokumentgeerdet und weiterhin klar verständlich.'
    };

    return `Du bist ein Lernassistent für Texterklärungen. ${styleInstructions[style]}

Regeln:
1. Antworte ausschließlich auf Basis der markierten Stelle und des bereitgestellten Dokumentkontexts.
2. Antworte in derselben Sprache wie das Zitat.
3. Übersetze nicht automatisch. Übersetzung nur, wenn explizit verlangt.
4. Strukturiere die Antwort, wenn genug Kontext vorhanden ist, in:
   - **Kurz erklärt**
   - **Im Dokumentkontext**
   - **Warum das wichtig ist**
5. Wenn der Ausschnitt fragmentiert wirkt, erwähne das knapp, aber fokussiere dich auf die bestmögliche Erklärung mit dem vorhandenen Kontext.
6. Kein unnötiges Füllmaterial, keine langen Allgemeinplätze.
7. Erfinde keine Herkunftsgeschichten oder Fakten, die nicht im bereitgestellten Kontext stehen.
8. Triff keine psychologischen oder situativen Annahmen, wenn sie nicht explizit im Kontext genannt sind.
9. Wenn Kontext fehlt, benenne die Lücke klar statt zu spekulieren.`;
  }

  private async retrieveExplanationContext(selectedText: string, documentId?: string): Promise<string> {
    if (!documentId) {
      return '';
    }

    const selectionEmbedding = await embeddingService.generateEmbedding(selectedText);
    const results = await this.vectorDB.searchSimilar(
      selectionEmbedding.embedding,
      3,
      { source: { $eq: documentId } }
    );

    const relevantResults = results
      .filter(result => result.score >= MIN_EXPLANATION_CONTEXT_SIMILARITY)
      .slice(0, 3);

    if (relevantResults.length === 0) {
      return '';
    }

    return relevantResults
      .map((result, index) => `[${index + 1}] ${result.text}`)
      .join('\n\n');
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
