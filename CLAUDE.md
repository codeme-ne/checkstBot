# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CheckstBot is a RAG-powered learning assistant built with Next.js 14 using **Pages Router** (not App Router). The system combines document processing with conversational AI using OpenAI embeddings and Pinecone vector database for semantic search and retrieval-augmented generation.

## Common Development Commands

```bash
# Development
npm run dev          # Start development server on http://localhost:3000

# Build & Production
npm run build        # Build for production
npm run start        # Start production server

# Testing & Quality (TDD Workflow)
npm run test         # Run all Jest tests
npm run test -- --watch  # Run tests in watch mode (TDD workflow)
npm run test -- path/to/test.ts  # Run specific test file
npm run test -- --coverage  # Run tests with coverage report
npm run lint         # Run ESLint
npm run type-check   # TypeScript type checking
```

## Development Methodology: Test-Driven Development (TDD)

**This project follows TDD principles. Always write tests BEFORE implementing features.**

### TDD Workflow
1. **Red**: Write a failing test for the new functionality
2. **Green**: Write minimal code to make the test pass
3. **Refactor**: Improve the code while keeping tests green

### TDD Commands
```bash
# Start TDD session
npm run test -- --watch

# Run tests for specific feature during TDD
npm run test -- --watch path/to/feature.test.ts

# Check test coverage after implementation
npm run test -- --coverage
```

## Architecture Overview

### RAG Pipeline Flow

The RAG (Retrieval-Augmented Generation) pipeline orchestrates the interaction between user queries, vector database, and LLM:

1. User query submitted via UI to `/api/chat`
2. `/api/chat` utilizes `lib/` functions to:
   - Generate embeddings for the query (OpenAI)
   - Retrieve relevant context from Pinecone using query embeddings
   - Construct comprehensive prompt with query and context
   - Send enhanced prompt to OpenAI's LLM for response generation
3. LLM response returned to UI for display

### Core Components

1. **RAG Orchestration** (`lib/rag.ts`):
   - Central pipeline coordination
   - Document chunking and processing
   - Embedding generation via OpenAI
   - Context retrieval and prompt construction

2. **Document Processing** (`lib/document-parser.ts`):
   - Handles PDF, DOCX, TXT, and Markdown files
   - Text extraction with format-specific parsers
   - Semantic chunking strategy

3. **Vector Database** (`lib/vector-db.ts`):
   - Pinecone client management
   - Vector storage with metadata
   - Similarity search implementation

4. **Configuration** (`lib/config.ts`):
   - Environment variable management
   - API key configuration

5. **Embeddings** (`lib/embedding.ts`):
   - OpenAI embedding generation
   - Batch processing capabilities

### API Routes

- `/api/upload`: Document upload and processing endpoint
- `/api/chat`: Chat completion with RAG context retrieval

### Frontend Structure

- **Router Type**: Pages Router (not App Router)
- **Main Interface** (`pages/index.tsx`): 2-panel layout with document viewer and chat
- **Components Directory**: Currently empty - all UI logic embedded in pages/index.tsx

## Environment Configuration

Required environment variables in `.env.local`:

```env
OPENAI_API_KEY=sk-...
PINECONE_API_KEY=...
PINECONE_ENVIRONMENT=...
PINECONE_INDEX=...
```

## Technology Stack

- **Framework**: Next.js 14 with Pages Router
- **Language**: TypeScript (strict mode enabled)
- **Styling**: Tailwind CSS
- **AI/ML**: OpenAI API, Langchain, Pinecone
- **Document Processing**: pdf-parse, mammoth, gray-matter
- **Testing**: Jest with React Testing Library

## Path Aliases

The project uses TypeScript path aliases:
- `@/*` → `./src/*`
- `@/components/*` → `./components/*`
- `@/lib/*` → `./lib/*`
- `@/types/*` → `./types/*`
- `@/utils/*` → `./utils/*`

## Key Implementation Details

### Document Processing Flow
1. User uploads document via file upload interface
2. Document parsed based on file type (PDF/DOCX/TXT/MD)
3. Text extracted and preprocessed
4. Content chunked into semantic segments with overlap
5. Chunks embedded using OpenAI text-embedding-ada-002
6. Vectors stored in Pinecone with metadata
7. Chat queries trigger semantic search for relevant chunks
8. Retrieved context passed to LLM for augmented responses

### LLM Integration
System designed to support multiple LLMs (GPT-4, Claude 3.5, Gemini, Llama) though full multi-model support may not be complete.

## Current State & Refactoring Opportunities

### Working Features
- Basic RAG functionality implemented
- 2-panel interface structure in place
- Core document processing and vector storage working
- Jest testing infrastructure configured

### Refactoring Opportunities
- **UI Component Extraction**: All UI logic currently in `pages/index.tsx`. Extract reusable components:
  - `ChatInput.tsx` - Input field and submit button
  - `ChatMessage.tsx` - Individual message rendering
  - `MessageList.tsx` - Message array display
  - `DocumentViewer.tsx` - Document display panel
  - `FileUpload.tsx` - Upload interface

### Testing Strategy (TDD Approach)

Current test coverage is minimal. When adding new features, follow TDD:

1. **Before writing any new code**:
   - Write failing tests that define the expected behavior
   - Tests should cover edge cases and error scenarios

2. **Priority areas for TDD**:
   - Unit and integration tests for RAG pipeline logic in `lib/`
   - Integration tests for API routes in `pages/api/`
   - Unit tests for UI components before extracting from `pages/index.tsx`

3. **Test file naming convention**:
   - Unit tests: `filename.test.ts` (co-located with source)
   - Integration tests: `__tests__/integration/feature.test.ts`

## Development Notes

- **TDD is mandatory**: Write tests first, then implementation
- All routing and data fetching uses Pages Router conventions
- API routes follow Next.js Pages Router patterns in `pages/api/`
- When adding new features, maintain Pages Router patterns
- Node.js version requirement: >=18.17.0

## TDD Example Workflow

When implementing a new feature (e.g., adding a document search function):

```bash
# 1. Create the test file first
touch lib/search.test.ts

# 2. Write failing tests defining the behavior
# 3. Run tests in watch mode
npm run test -- --watch lib/search.test.ts

# 4. Implement minimal code to pass tests
# 5. Refactor while keeping tests green
# 6. Check coverage
npm run test -- --coverage lib/search.test.ts
```