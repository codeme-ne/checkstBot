#!/usr/bin/env node

/**
 * Pre-deployment check script for CheckstBot
 * Validates configuration and runs essential tests before production deployment
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 CheckstBot Pre-Deployment Validation\n');

const checks = [];
let passed = 0;
let failed = 0;

function addCheck(name, fn) {
  checks.push({ name, fn });
}

function runCheck(check) {
  try {
    console.log(`⏳ ${check.name}...`);
    check.fn();
    console.log(`✅ ${check.name} - PASSED\n`);
    passed++;
  } catch (error) {
    console.log(`❌ ${check.name} - FAILED`);
    console.log(`   Error: ${error.message}\n`);
    failed++;
  }
}

// Check 1: Verify package.json and dependencies
addCheck('Package Configuration', () => {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));

  if (!packageJson.engines || !packageJson.engines.node) {
    throw new Error('Node.js engine version not specified in package.json');
  }

  const requiredDeps = ['next', 'react', 'openai', '@pinecone-database/pinecone'];
  for (const dep of requiredDeps) {
    if (!packageJson.dependencies[dep]) {
      throw new Error(`Missing required dependency: ${dep}`);
    }
  }
});

// Check 2: TypeScript compilation
addCheck('TypeScript Compilation', () => {
  try {
    execSync('npm run type-check', { stdio: 'pipe' });
  } catch (error) {
    throw new Error('TypeScript compilation failed. Run "npm run type-check" for details.');
  }
});

// Check 3: Build process
addCheck('Production Build', () => {
  try {
    execSync('npm run build', { stdio: 'pipe' });
  } catch (error) {
    throw new Error('Production build failed. Run "npm run build" for details.');
  }
});

// Check 4: Essential files exist
addCheck('Required Files', () => {
  const requiredFiles = [
    'pages/index.tsx',
    'pages/api/chat.ts',
    'pages/api/upload.ts',
    'lib/rag.ts',
    'lib/vector-db.ts',
    'lib/config.ts',
    'next.config.js',
    'vercel.json'
  ];

  for (const file of requiredFiles) {
    if (!fs.existsSync(file)) {
      throw new Error(`Missing required file: ${file}`);
    }
  }
});

// Check 5: Environment variables template
addCheck('Environment Configuration', () => {
  if (!fs.existsSync('.env.example')) {
    throw new Error('Missing .env.example file for deployment reference');
  }

  const envExample = fs.readFileSync('.env.example', 'utf8');
  const requiredEnvVars = [
    'OPENAI_API_KEY',
    'PINECONE_API_KEY',
    'PINECONE_ENVIRONMENT',
    'PINECONE_INDEX'
  ];

  for (const envVar of requiredEnvVars) {
    if (!envExample.includes(envVar)) {
      throw new Error(`Missing environment variable in .env.example: ${envVar}`);
    }
  }
});

// Check 6: Vercel configuration
addCheck('Vercel Configuration', () => {
  const vercelConfig = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));

  if (!vercelConfig.functions) {
    throw new Error('Vercel functions configuration missing');
  }

  if (!vercelConfig.headers) {
    throw new Error('Security headers configuration missing');
  }
});

// Check 7: API routes syntax
addCheck('API Routes Validation', () => {
  const apiFiles = ['pages/api/chat.ts', 'pages/api/upload.ts', 'pages/api/csrf.ts'];

  for (const apiFile of apiFiles) {
    if (fs.existsSync(apiFile)) {
      const content = fs.readFileSync(apiFile, 'utf8');

      // Check for proper Next.js API handler export
      if (!content.includes('export default') || !content.includes('NextApiRequest')) {
        throw new Error(`${apiFile} doesn't follow proper Next.js API pattern`);
      }
    }
  }
});

// Check 8: Security measures
addCheck('Security Implementation', () => {
  // Check for CSRF protection
  if (!fs.existsSync('lib/csrf.ts')) {
    throw new Error('CSRF protection module missing');
  }

  // Check for rate limiting
  if (!fs.existsSync('lib/rate-limit.ts')) {
    throw new Error('Rate limiting module missing');
  }

  // Check Next.js config has security headers
  const nextConfig = fs.readFileSync('next.config.js', 'utf8');
  if (!nextConfig.includes('X-Frame-Options') || !nextConfig.includes('Content-Security-Policy')) {
    throw new Error('Security headers not properly configured in next.config.js');
  }
});

// Run all checks
console.log('Running pre-deployment checks...\n');

for (const check of checks) {
  runCheck(check);
}

// Summary
console.log('📊 Pre-Deployment Check Summary');
console.log('================================');
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log(`📝 Total:  ${checks.length}\n`);

if (failed === 0) {
  console.log('🎉 All checks passed! CheckstBot is ready for production deployment.\n');
  console.log('Next steps:');
  console.log('1. Commit your changes to GitHub');
  console.log('2. Deploy using: vercel --prod');
  console.log('3. Set environment variables in Vercel dashboard');
  console.log('4. Test your deployed application\n');
  process.exit(0);
} else {
  console.log('⚠️  Some checks failed. Please address the issues above before deploying.\n');
  process.exit(1);
}