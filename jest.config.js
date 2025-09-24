const nextJest = require('next/jest');

const createJestConfig = nextJest({
  dir: './',
});

const customJestConfig = {
  setupFiles: ['<rootDir>/jest.setup.test.js'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  testPathIgnorePatterns: [
    '<rootDir>/__tests__/integration/real-api.integration.test.ts',
    '<rootDir>/__tests__/lib/document-parser.test.ts',
    '<rootDir>/__tests__/lib/embedding.test.ts',
    '<rootDir>/__tests__/test-utils.ts',
  ],
  moduleNameMapper: {
    '^@/components/(.*)$': '<rootDir>/components/$1',
    '^@/lib/(.*)$': '<rootDir>/lib/$1',
    '^@/pages/(.*)$': '<rootDir>/pages/$1',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(react-markdown|remark-gfm|rehype-.*|hast-.*|unist-.*|unified|bail|is-plain-obj|trough|vfile|markdown-table|mdast-.*|micromark.*|parse-entities|character-entities|property-information|comma-separated-tokens|space-separated-tokens|ccount|escape-string-regexp|decode-named-character-reference)/)',
  ],
};

module.exports = createJestConfig(customJestConfig);
