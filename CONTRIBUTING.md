# Contributing to checkstBot

Thank you for your interest in contributing to checkstBot! This document provides guidelines and instructions for contributing.

## Code of Conduct

By participating in this project, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md).

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- OpenAI API key
- Pinecone API key

### Local Development Setup

1. **Fork and clone the repository**
   ```bash
   git clone https://github.com/YOUR_USERNAME/checkstBot.git
   cd checkstBot
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your API keys
   ```

4. **Run the development server**
   ```bash
   npm run dev
   ```

5. **Run tests**
   ```bash
   npm run test
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

# Run tests for specific feature
npm run test -- --watch path/to/feature.test.ts

# Check coverage
npm run test -- --coverage
```

## How to Contribute

### Reporting Bugs

Before submitting a bug report:
1. Check existing issues to avoid duplicates
2. Collect relevant information (Node version, OS, steps to reproduce)

Use the [bug report template](.github/ISSUE_TEMPLATE/bug_report.md) when creating issues.

### Suggesting Features

We welcome feature suggestions! Use the [feature request template](.github/ISSUE_TEMPLATE/feature_request.md).

### Pull Requests

1. **Create a branch**
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/your-bug-fix
   ```

2. **Follow TDD**: Write tests first, then implementation

3. **Ensure quality**
   ```bash
   npm run lint          # No linting errors
   npm run type-check    # No TypeScript errors
   npm run test          # All tests pass
   ```

4. **Commit with clear messages**
   ```
   feat: add document summarization feature
   fix: resolve PDF parsing error for encrypted files
   docs: update API documentation
   test: add tests for chat persistence
   ```

5. **Push and create PR**
   ```bash
   git push origin feature/your-feature-name
   ```

### PR Requirements

- [ ] Tests written and passing
- [ ] TypeScript compiles without errors
- [ ] Linting passes
- [ ] Documentation updated if needed
- [ ] PR description explains the changes

## Code Style

### TypeScript

- Enable strict mode
- Avoid `any` - use `unknown` with type guards
- Use explicit return types for functions
- Prefer `const` over `let`

### React

- Use functional components with hooks
- Keep components focused and small
- Use TypeScript interfaces for props

### File Naming

- Components: `PascalCase.tsx`
- Utilities: `kebab-case.ts`
- Tests: `component-name.test.tsx` or `utility-name.test.ts`

### Testing

- Place tests in `__tests__/` directory
- Mirror the source structure
- Name test files with `.test.ts` or `.test.tsx` suffix

## Project Structure

```
checkstBot/
├── components/          # React components
├── lib/                 # Core utilities and services
├── pages/               # Next.js pages (Pages Router)
│   └── api/            # API routes
├── styles/             # Global styles
├── __tests__/          # Test files
│   ├── components/
│   └── lib/
└── types/              # TypeScript type definitions
```

## AI-Generated Contributions

We accept AI-assisted contributions with these requirements:

1. **Human Review**: All AI-generated code must be reviewed and understood
2. **Testing**: AI code must have corresponding tests
3. **Disclosure**: Mention AI assistance in the PR description
4. **Responsibility**: You are responsible for the code you submit

## Questions?

- Open a [discussion](https://github.com/codeme-ne/checkstBot/discussions)
- Check existing issues and documentation
- Reach out via the contact in [SECURITY.md](SECURITY.md)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
