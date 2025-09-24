# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CheckstBot is a production-ready RAG-powered learning assistant built with Next.js 14 using **Pages Router** (not App Router). The system combines sophisticated document processing with conversational AI using OpenAI embeddings and Pinecone vector database for semantic search and retrieval-augmented generation.

**Current Status: Production-ready with comprehensive security, testing, and deployment infrastructure.**

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

# Production & Deployment
node scripts/pre-deploy-check.js  # Run comprehensive pre-deployment validation
vercel --prod        # Deploy to production
vercel dev           # Test deployment locally
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

6. **Security Infrastructure**:
   - **CSRF Protection** (`lib/csrf.ts`, `lib/csrf-client.ts`): Token-based CSRF validation
   - **Rate Limiting** (`lib/rate-limit.ts`): Request throttling and abuse prevention
   - **Logger** (`lib/logger.ts`): Structured logging system

7. **Chat Persistence** (`lib/chat-storage.ts`):
   - Document-scoped conversation history
   - localStorage-based offline persistence
   - Graceful fallback mechanisms

### API Routes

- `/api/upload`: Document upload and processing endpoint with file validation
- `/api/chat`: Chat completion with RAG context retrieval and rate limiting
- `/api/csrf`: CSRF token generation and validation

### Production-Grade Component Architecture

The application features a sophisticated component-based architecture with 11 specialized React components:

#### Document Display Components
- **`EnhancedDocumentViewer.tsx`**: Smart document factory with type detection and selection handling
- **`PDFViewer.tsx`**: Specialized PDF rendering with zoom and navigation
- **`MarkdownViewer.tsx`**: Rich markdown display with syntax highlighting
- **`TextViewer.tsx`**: Clean text document presentation
- **`DocumentViewer.tsx`**: Legacy document display (kept for compatibility)

#### Interactive Components
- **`ChatInterface.tsx`**: Full-featured chat UI with RAG integration, message persistence, and real-time streaming
- **`MessageBubble.tsx`**: Individual message rendering with role-based styling
- **`SelectionTooltip.tsx`**: Context-aware text selection with "Explain" functionality

#### Utility Components
- **`FileUpload.tsx`**: Drag-and-drop file upload with validation and progress indication
- **`Toast.tsx`**: User feedback system for notifications and alerts
- **`ErrorBoundary.tsx`**: React error boundary for graceful error handling

#### Frontend Architecture
- **Router Type**: Pages Router (not App Router)
- **Main Interface** (`pages/index.tsx`): Clean orchestration layer using modular components
- **State Management**: React hooks with localStorage persistence
- **UI Patterns**: Modern React patterns with TypeScript for type safety

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
- **Styling**: Tailwind CSS with responsive design
- **AI/ML**: OpenAI API (GPT-4, text-embedding-ada-002), Pinecone Vector Database
- **Document Processing**: pdf-parse, mammoth, gray-matter, remark/rehype
- **Testing**: Jest with React Testing Library
- **Security**: CSRF tokens, rate limiting, security headers
- **Deployment**: Vercel with optimized configuration
- **State Management**: React Context + localStorage persistence

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
Primary integration with OpenAI's GPT-4 for chat completions with streaming support. System architecture supports multiple LLMs though currently optimized for OpenAI.

## Production Features & Security

### Implemented Security Measures
- **CSRF Protection**: Token-based validation on all state-changing operations
- **Rate Limiting**: Prevents API abuse with configurable thresholds
- **Security Headers**: Comprehensive HTTP security headers via Vercel configuration
  - Content Security Policy
  - X-Frame-Options: DENY
  - X-Content-Type-Options: nosniff
  - Strict Transport Security
- **Input Validation**: Sanitization and validation on all user inputs
- **Error Handling**: Graceful error boundaries and user-friendly error messages

### Production Infrastructure
- **Vercel Deployment**: Optimized configuration with regional deployment (IAD1)
- **Function Optimization**: Memory and timeout optimization for different API routes
- **Pre-deployment Validation**: Comprehensive automated checks via `scripts/pre-deploy-check.js`
- **Environment Management**: Secure environment variable handling

### Advanced Features
- **Smart Document Handling**: Automatic type detection and specialized viewers
- **Text Selection & Explanation**: Interactive document exploration with AI assistance
- **Conversation Persistence**: Document-scoped chat history with offline support
- **Streaming Responses**: Real-time LLM response streaming for better UX
- **Responsive Design**: Mobile-first design with Tailwind CSS
- **Error Boundaries**: Comprehensive error handling with recovery options

### Current Status: Production-Ready
All major components are implemented and battle-tested:
- ✅ Complete component architecture (11 specialized components)
- ✅ Full RAG pipeline with semantic search
- ✅ Production security measures
- ✅ Comprehensive testing infrastructure
- ✅ Optimized Vercel deployment configuration
- ✅ Pre-deployment validation automation

### Testing Strategy (TDD Approach)

The project includes comprehensive test coverage for critical components:

#### Implemented Tests
- **`__tests__/components/ChatInterface.test.tsx`**: Core chat functionality testing
- **`__tests__/components/ChatInterface-persistence.test.tsx`**: Chat history persistence testing
- **`__tests__/lib/chat-storage.test.ts`**: Storage service unit tests

#### TDD Guidelines for New Features

1. **Before writing any new code**:
   - Write failing tests that define the expected behavior
   - Tests should cover edge cases and error scenarios

2. **Current test coverage areas**:
   - ✅ Chat interface and messaging
   - ✅ Conversation persistence
   - ✅ Storage service reliability
   - 🔄 RAG pipeline logic (partial coverage)
   - 🔄 API route integration tests (in progress)

3. **Test file naming convention**:
   - Component tests: `__tests__/components/ComponentName.test.tsx`
   - Service tests: `__tests__/lib/service-name.test.ts`
   - Integration tests: `__tests__/integration/feature.test.ts`

## Development Notes

- **TDD is mandatory**: Write tests first, then implementation
- All routing and data fetching uses Pages Router conventions
- API routes follow Next.js Pages Router patterns in `pages/api/`
- When adding new features, maintain Pages Router patterns
- Node.js version requirement: >=18.17.0
- **Security-first development**: All new features must include CSRF protection and rate limiting
- **Component isolation**: Each component should be testable in isolation with clear interfaces

## Deployment Workflow

### Pre-Deployment Validation
```bash
# Run comprehensive pre-deployment checks
node scripts/pre-deploy-check.js

# This validates:
# - Package configuration and dependencies
# - TypeScript compilation
# - Production build process
# - Required files existence
# - Environment configuration
# - Vercel configuration
# - API routes validation
# - Security implementation
```

### Production Deployment
```bash
# Deploy to Vercel production
vercel --prod

# Set environment variables in Vercel dashboard:
# - OPENAI_API_KEY
# - PINECONE_API_KEY
# - PINECONE_ENVIRONMENT
# - PINECONE_INDEX
```

### Post-Deployment Testing
After deployment, verify:
- Document upload and processing
- RAG chat functionality
- Text selection and explanation features
- Mobile responsiveness
- Security headers and CSRF protection

## TDD Example Workflow

When implementing a new feature (e.g., adding a document search function):

```bash
# 1. Create the test file first
touch __tests__/lib/search.test.ts

# 2. Write failing tests defining the behavior
# 3. Run tests in watch mode
npm run test -- --watch __tests__/lib/search.test.ts

# 4. Implement minimal code to pass tests
# 5. Refactor while keeping tests green
# 6. Check coverage
npm run test -- --coverage __tests__/lib/search.test.ts
```

## Architecture Decision Records

### Component Architecture Choice
- **Decision**: Extract UI logic into specialized, reusable components
- **Rationale**: Improves maintainability, testability, and code reuse
- **Implementation**: 11 components covering document display, interaction, and utilities
- **Status**: ✅ Complete

### Security-First Approach
- **Decision**: Implement comprehensive security measures from the start
- **Rationale**: Educational applications handle sensitive user data and documents
- **Implementation**: CSRF protection, rate limiting, security headers, input validation
- **Status**: ✅ Complete

### RAG Pipeline Design
- **Decision**: Use OpenAI embeddings with Pinecone for vector search
- **Rationale**: Proven performance for educational content retrieval
- **Implementation**: Semantic chunking, context retrieval, prompt augmentation
- **Status**: ✅ Complete and optimized