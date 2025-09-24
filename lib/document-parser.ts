import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import { marked } from 'marked';
import matter from 'gray-matter';
import * as crypto from 'crypto';

export interface DocumentMetadata {
  title?: string;
  author?: string;
  pages?: number;
  wordCount?: number;
  language?: string;
  createdAt?: string;
  documentHash?: string;
}

export interface ParsedDocument {
  content: string;
  metadata: DocumentMetadata;
  chunks: DocumentChunk[];
}

export interface DocumentChunk {
  text: string;
  metadata: {
    source: string;
    page?: number;
    chunkIndex: number;
    timestamp: string;
    documentHash?: string;
  };
}

export class DocumentParser {
  private readonly CHUNK_SIZE = parseInt(process.env.CHUNK_SIZE || '1000');
  private readonly CHUNK_OVERLAP = parseInt(process.env.CHUNK_OVERLAP || '200');

  /**
   * Generate SHA-256 hash of document content
   */
  private generateDocumentHash(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * Parse a document based on its file type
   */
  async parseDocument(
    buffer: Buffer,
    filename: string,
    mimeType: string
  ): Promise<ParsedDocument> {
    const source = filename;
    const timestamp = new Date().toISOString();
    const documentHash = this.generateDocumentHash(buffer);

    let content = '';
    let metadata: DocumentMetadata = {
      documentHash,
    };

    try {
      switch (mimeType) {
        case 'application/pdf':
          const pdfResult = await this.parsePDF(buffer);
          content = pdfResult.content;
          metadata = pdfResult.metadata;
          break;

        case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        case 'application/msword':
          const docxResult = await this.parseDOCX(buffer);
          content = docxResult.content;
          metadata = docxResult.metadata;
          break;

        case 'text/plain':
          content = buffer.toString('utf-8');
          metadata = { wordCount: this.countWords(content) };
          break;

        case 'text/markdown':
          const mdResult = this.parseMarkdown(buffer.toString('utf-8'));
          content = mdResult.content;
          metadata = mdResult.metadata;
          break;

        default:
          throw new Error(`Unsupported file type: ${mimeType}`);
      }

      const chunks = this.createChunks(content, source, timestamp, documentHash);

      return {
        content,
        metadata: {
          ...metadata,
          wordCount: this.countWords(content),
          createdAt: timestamp,
          documentHash,
        },
        chunks,
      };
    } catch (error) {
      console.error('Error parsing document:', error);
      throw new Error(`Failed to parse document: ${filename}`);
    }
  }

  /**
   * Parse PDF document
   */
  private async parsePDF(buffer: Buffer): Promise<{ content: string; metadata: DocumentMetadata }> {
    try {
      const data = await pdfParse(buffer);
      
      return {
        content: data.text,
        metadata: {
          pages: data.numpages,
          title: data.info?.Title || undefined,
          author: data.info?.Author || undefined,
        },
      };
    } catch (error) {
      console.error('PDF parsing error:', error);
      throw new Error('Failed to parse PDF document');
    }
  }

  /**
   * Parse DOCX document
   */
  private async parseDOCX(buffer: Buffer): Promise<{ content: string; metadata: DocumentMetadata }> {
    try {
      const result = await mammoth.extractRawText({ buffer });
      
      return {
        content: result.value,
        metadata: {
          wordCount: this.countWords(result.value),
        },
      };
    } catch (error) {
      console.error('DOCX parsing error:', error);
      throw new Error('Failed to parse DOCX document');
    }
  }

  /**
   * Parse Markdown document
   */
  private parseMarkdown(content: string): { content: string; metadata: DocumentMetadata } {
    try {
      const { data: frontmatter, content: markdown } = matter(content);
      const htmlContent = marked(markdown);
      
      // Convert HTML back to plain text for chunking
      const plainText = htmlContent.replace(/<[^>]*>/g, '');
      
      return {
        content: plainText,
        metadata: {
          title: frontmatter.title || undefined,
          author: frontmatter.author || undefined,
          ...frontmatter,
        },
      };
    } catch (error) {
      console.error('Markdown parsing error:', error);
      throw new Error('Failed to parse Markdown document');
    }
  }

  /**
   * Create text chunks with overlap for better context preservation
   * Uses paragraph-based chunking for better semantic coherence
   */
  private createChunks(content: string, source: string, timestamp: string, documentHash?: string): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];

    if (!content || !content.trim()) return chunks;

    // First try to split by paragraphs for better semantic chunks
    const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim().length > 0);

    // If we have meaningful paragraphs, use them as natural chunk boundaries
    if (paragraphs.length > 1) {
      let chunkIndex = 0;
      let currentChunk = '';

      for (const paragraph of paragraphs) {
        const potentialChunk = currentChunk + (currentChunk ? '\n\n' : '') + paragraph;

        // If adding this paragraph would exceed chunk size, save current chunk
        if (potentialChunk.length > this.CHUNK_SIZE && currentChunk) {
          chunks.push({
            text: currentChunk.trim(),
            metadata: {
              source,
              chunkIndex: chunkIndex++,
              timestamp,
              documentHash,
            },
          });
          currentChunk = paragraph; // Start new chunk with current paragraph
        } else {
          currentChunk = potentialChunk;
        }
      }

      // Add remaining content as final chunk
      if (currentChunk.trim()) {
        chunks.push({
          text: currentChunk.trim(),
          metadata: {
            source,
            chunkIndex,
            timestamp,
            documentHash,
          },
        });
      }
    } else {
      // Fall back to sentence-based chunking for single paragraph or small content
      const sentences = this.splitIntoSentences(content);

      let currentChunk = '';
      let chunkIndex = 0;

      for (const sentence of sentences) {
        const potentialChunk = currentChunk + (currentChunk ? ' ' : '') + sentence;

        if (potentialChunk.length > this.CHUNK_SIZE && currentChunk) {
          // Save current chunk
          chunks.push({
            text: currentChunk.trim(),
            metadata: {
              source,
              chunkIndex,
              timestamp,
              documentHash,
            },
          });

          // Start new chunk with overlap
          const words = currentChunk.split(' ');
          const overlapWords = words.slice(-Math.floor(this.CHUNK_OVERLAP / 6)); // Approximate word count
          currentChunk = overlapWords.join(' ') + ' ' + sentence;
          chunkIndex++;
        } else {
          currentChunk = potentialChunk;
        }
      }

      // Add the last chunk if it has content
      if (currentChunk.trim()) {
        chunks.push({
          text: currentChunk.trim(),
          metadata: {
            source,
            chunkIndex,
            timestamp,
            documentHash,
          },
        });
      }
    }

    // Ensure we always have at least one chunk for non-empty content
    if (chunks.length === 0 && content.trim()) {
      chunks.push({
        text: content.trim(),
        metadata: {
          source,
          chunkIndex: 0,
          timestamp,
          documentHash,
        },
      });
    }

    return chunks;
  }

  /**
   * Split text into sentences for better chunking
   */
  private splitIntoSentences(text: string): string[] {
    // Handle empty or invalid input
    if (!text || typeof text !== 'string') {
      return [];
    }

    // Simple sentence splitting - could be enhanced with more sophisticated NLP
    return text
      .split(/[.!?]+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }

  /**
   * Count words in text
   */
  private countWords(text: string): number {
    return text.trim().split(/\s+/).length;
  }

  /**
   * Clean text by removing extra whitespace and special characters
   */
  private cleanText(text: string): string {
    return text
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s.,!?;:-]/g, '')
      .trim();
  }
}

export const documentParser = new DocumentParser();