# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2024-11-26

### Added

- **RAG Pipeline**: Complete retrieval-augmented generation system
  - Document chunking with semantic segmentation
  - OpenAI text-embedding-ada-002 for vector embeddings
  - Pinecone vector database integration
  - Configurable relevance thresholds

- **Document Processing**
  - PDF file support with pdf-parse
  - DOCX file support with mammoth
  - Plain text and Markdown support
  - Content-based MIME type validation

- **Chat Interface**
  - Real-time conversational AI with GPT-4
  - Document-scoped conversation history
  - LocalStorage persistence for offline support
  - Streaming response support

- **Document Viewers**
  - EnhancedDocumentViewer with automatic type detection
  - PDFViewer with zoom and navigation
  - MarkdownViewer with syntax highlighting
  - TextViewer for plain text documents
  - Text selection with "Explain" functionality

- **Security**
  - CSRF protection on all state-changing operations
  - Rate limiting for API abuse prevention
  - Comprehensive security headers
  - Input validation and sanitization
  - Content-based file type verification

- **Developer Experience**
  - Comprehensive test suite (53 tests)
  - TDD workflow documentation
  - TypeScript strict mode
  - Pre-deployment validation script

- **Deployment**
  - Vercel configuration with optimized settings
  - Environment variable management
  - Regional deployment (IAD1)

### Security

- Implemented timing-safe CSRF token comparison
- Added rate limiting to prevent API abuse
- Configured Content Security Policy headers
- Input validation on all user-facing endpoints

[Unreleased]: https://github.com/codeme-ne/checkstBot/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/codeme-ne/checkstBot/releases/tag/v0.1.0
