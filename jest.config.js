const nextJest = require('next/jest');

const createJestConfig = nextJest({
  dir: './',
});

const customJestConfig = {
  setupFiles: ['<rootDir>/jest.env.js'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  testPathIgnorePatterns: [
    '<rootDir>/e2e/',
    '<rootDir>/__tests__/integration/real-api.integration.test.ts',
    '<rootDir>/__tests__/lib/document-parser.test.ts',
    '<rootDir>/__tests__/lib/embedding.test.ts',
    '<rootDir>/__tests__/test-utils.ts',
  ],
  moduleNameMapper: {
    '^@/components/(.*)$': '<rootDir>/components/$1',
    '^@/lib/(.*)$': '<rootDir>/lib/$1',
    '^@/pages/(.*)$': '<rootDir>/pages/$1',
    '^react-markdown$': '<rootDir>/__mocks__/react-markdown.tsx',
    '^remark-gfm$': '<rootDir>/__mocks__/remark-gfm.ts',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(react-markdown|remark-.*|rehype-.*|hast-.*|unist-.*|unified|bail|is-plain-obj|trough|vfile.*|markdown-table|mdast-.*|micromark.*|parse-entities|character-entities.*|property-information|comma-separated-tokens|space-separated-tokens|ccount|escape-string-regexp|decode-named-character-reference|devlop|estree-util-.*|trim-lines|zwitch|html-url-attributes)/)',
  ],
};

module.exports = createJestConfig(customJestConfig);
