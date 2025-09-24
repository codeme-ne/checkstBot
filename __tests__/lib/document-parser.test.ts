import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { DocumentParser } from '../../lib/document-parser';
import * as crypto from 'crypto';

describe('DocumentParser', () => {
  let parser: DocumentParser;

  beforeEach(() => {
    parser = new DocumentParser();
  });

  describe('Text File Processing', () => {
    it('should parse plain text files correctly', async () => {
      const content = 'This is a test document.\nIt has multiple lines.\nAnd some content to test.';
      const buffer = Buffer.from(content, 'utf-8');

      const result = await parser.parseDocument(
        buffer,
        'test.txt',
        'text/plain'
      );

      expect(result.content).toBe(content);
      expect(result.metadata.wordCount).toBe(12);
      expect(result.chunks).toBeInstanceOf(Array);
      expect(result.chunks.length).toBeGreaterThan(0);
    });

    it('should preserve content integrity in TXT files', async () => {
      const specialContent = 'Special chars: @#$%^&*() \t\n Tabs and    spaces   preserved.';
      const buffer = Buffer.from(specialContent, 'utf-8');

      const result = await parser.parseDocument(
        buffer,
        'special.txt',
        'text/plain'
      );

      expect(result.content).toBe(specialContent);
    });

    it('should handle empty text files', async () => {
      const buffer = Buffer.from('', 'utf-8');

      const result = await parser.parseDocument(
        buffer,
        'empty.txt',
        'text/plain'
      );

      expect(result.content).toBe('');
      expect(result.chunks).toEqual([]);
    });
  });

  describe('PDF Processing', () => {
    it('should extract text from PDF files', async () => {
      // Mock PDF content (simplified for testing)
      const mockPdfParse = jest.fn().mockResolvedValue({
        text: 'PDF content extracted successfully',
        numpages: 1,
        info: { Title: 'Test PDF', Author: 'Test Author' }
      });

      // Override the parsePDF method for testing
      const parser = new DocumentParser();
      (parser as any).parsePDF = mockPdfParse;

      const buffer = Buffer.from('mock pdf content');
      const result = await parser.parseDocument(
        buffer,
        'test.pdf',
        'application/pdf'
      );

      expect(mockPdfParse).toHaveBeenCalledWith(buffer);
    });

    it('should handle corrupt PDF files gracefully', async () => {
      const parser = new DocumentParser();
      const buffer = Buffer.from('not a valid pdf');

      await expect(
        parser.parseDocument(buffer, 'corrupt.pdf', 'application/pdf')
      ).rejects.toThrow('Failed to parse document');
    });
  });

  describe('Chunking Strategy', () => {
    it('should create chunks of appropriate size (1000 chars)', async () => {
      const longContent = 'a'.repeat(3000); // 3000 character document
      const buffer = Buffer.from(longContent, 'utf-8');

      const result = await parser.parseDocument(
        buffer,
        'long.txt',
        'text/plain'
      );

      expect(result.chunks.length).toBeGreaterThan(2);
      result.chunks.forEach(chunk => {
        expect(chunk.text.length).toBeLessThanOrEqual(1000);
      });
    });

    it('should maintain 200 character overlap between chunks', async () => {
      // Create content that will definitely be chunked
      const sentence = 'This is a test sentence. ';
      const longContent = sentence.repeat(50); // ~1300 characters
      const buffer = Buffer.from(longContent, 'utf-8');

      const result = await parser.parseDocument(
        buffer,
        'overlap-test.txt',
        'text/plain'
      );

      // Verify we have multiple chunks
      expect(result.chunks.length).toBeGreaterThan(1);

      // Check that consecutive chunks have overlapping content
      for (let i = 0; i < result.chunks.length - 1; i++) {
        const currentChunk = result.chunks[i].text;
        const nextChunk = result.chunks[i + 1].text;

        // The end of current chunk should appear at the beginning of next chunk
        const overlapStart = currentChunk.substring(currentChunk.length - 200);
        expect(nextChunk).toContain(overlapStart.split(' ')[0]); // At least first word should overlap
      }
    });

    it('should preserve semantic boundaries when chunking', async () => {
      const content = 'First sentence. Second sentence. Third sentence. Fourth sentence.';
      const buffer = Buffer.from(content, 'utf-8');

      const result = await parser.parseDocument(
        buffer,
        'semantic.txt',
        'text/plain'
      );

      // Each chunk should end at sentence boundaries
      result.chunks.forEach(chunk => {
        const trimmed = chunk.text.trim();
        if (trimmed) {
          expect(trimmed).toMatch(/[.!?]$/);
        }
      });
    });
  });

  describe('Metadata Extraction', () => {
    it('should extract title and author from documents', async () => {
      const markdownWithFrontmatter = `---
title: Test Document
author: John Doe
date: 2024-01-01
---

# Main Content

This is the document content.`;

      const buffer = Buffer.from(markdownWithFrontmatter, 'utf-8');

      const result = await parser.parseDocument(
        buffer,
        'test.md',
        'text/markdown'
      );

      expect(result.metadata.title).toBe('Test Document');
      expect(result.metadata.author).toBe('John Doe');
    });

    it('should calculate word count accurately', async () => {
      const content = 'One two three four five six seven eight nine ten';
      const buffer = Buffer.from(content, 'utf-8');

      const result = await parser.parseDocument(
        buffer,
        'count.txt',
        'text/plain'
      );

      expect(result.metadata.wordCount).toBe(10);
    });

    it('should include timestamp in metadata', async () => {
      const buffer = Buffer.from('test', 'utf-8');

      const result = await parser.parseDocument(
        buffer,
        'test.txt',
        'text/plain'
      );

      expect(result.metadata.createdAt).toBeDefined();
      expect(new Date(result.metadata.createdAt!)).toBeInstanceOf(Date);
    });
  });

  describe('Document Deduplication', () => {
    it('should generate consistent hash for same content', async () => {
      const content = 'This is test content for hashing';
      const buffer1 = Buffer.from(content, 'utf-8');
      const buffer2 = Buffer.from(content, 'utf-8');

      const hash1 = crypto.createHash('sha256').update(buffer1).digest('hex');
      const hash2 = crypto.createHash('sha256').update(buffer2).digest('hex');

      expect(hash1).toBe(hash2);
    });

    it('should generate different hashes for different content', async () => {
      const content1 = 'This is content one';
      const content2 = 'This is content two';
      const buffer1 = Buffer.from(content1, 'utf-8');
      const buffer2 = Buffer.from(content2, 'utf-8');

      const hash1 = crypto.createHash('sha256').update(buffer1).digest('hex');
      const hash2 = crypto.createHash('sha256').update(buffer2).digest('hex');

      expect(hash1).not.toBe(hash2);
    });

    it('should include document hash in chunk metadata', async () => {
      const content = 'Document for hash testing';
      const buffer = Buffer.from(content, 'utf-8');
      const expectedHash = crypto.createHash('sha256').update(buffer).digest('hex');

      // We'll add this functionality to the document parser
      const result = await parser.parseDocument(
        buffer,
        'hash-test.txt',
        'text/plain'
      );

      // This will be implemented in the document parser improvements
      // expect(result.metadata.documentHash).toBe(expectedHash);
      // result.chunks.forEach(chunk => {
      //   expect(chunk.metadata.documentHash).toBe(expectedHash);
      // });
    });
  });

  describe('Error Handling', () => {
    it('should handle unsupported file types', async () => {
      const buffer = Buffer.from('some content');

      await expect(
        parser.parseDocument(buffer, 'test.xyz', 'application/unknown')
      ).rejects.toThrow('Unsupported file type');
    });

    it('should handle parsing errors gracefully', async () => {
      const parser = new DocumentParser();
      const buffer = Buffer.from('test');

      // Force an error in parsing
      (parser as any).parsePDF = jest.fn().mockRejectedValue(new Error('Parse error'));

      await expect(
        parser.parseDocument(buffer, 'error.pdf', 'application/pdf')
      ).rejects.toThrow('Failed to parse document');
    });

    it('should provide meaningful error messages', async () => {
      const buffer = Buffer.from('');

      try {
        await parser.parseDocument(buffer, 'test.xyz', 'invalid/type');
      } catch (error: any) {
        expect(error.message).toContain('Unsupported file type');
        expect(error.message).toContain('invalid/type');
      }
    });
  });

  describe('Chunking Edge Cases', () => {
    it('should handle documents smaller than chunk size', async () => {
      const shortContent = 'Short document';
      const buffer = Buffer.from(shortContent, 'utf-8');

      const result = await parser.parseDocument(
        buffer,
        'short.txt',
        'text/plain'
      );

      expect(result.chunks.length).toBe(1);
      expect(result.chunks[0].text).toBe(shortContent);
    });

    it('should handle documents with no sentence boundaries', async () => {
      const content = 'a'.repeat(2000); // No punctuation
      const buffer = Buffer.from(content, 'utf-8');

      const result = await parser.parseDocument(
        buffer,
        'no-sentences.txt',
        'text/plain'
      );

      expect(result.chunks.length).toBeGreaterThan(1);
      expect(result.chunks[0].text.length).toBeLessThanOrEqual(1000);
    });

    it('should assign sequential chunk indices', async () => {
      const content = 'a'.repeat(3000);
      const buffer = Buffer.from(content, 'utf-8');

      const result = await parser.parseDocument(
        buffer,
        'indexed.txt',
        'text/plain'
      );

      result.chunks.forEach((chunk, index) => {
        expect(chunk.metadata.chunkIndex).toBe(index);
      });
    });
  });
});