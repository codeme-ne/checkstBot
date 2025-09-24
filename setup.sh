#!/bin/bash

# checkstBot Setup Script
# This script sets up the complete RAG-powered learning assistant

echo "🚀 Setting up checkstBot - RAG Learning Assistant"
echo "================================================"

# Check Node.js version
echo "📋 Checking Node.js version..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18+ required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js version: $(node -v)"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Check if installation was successful
if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo "✅ Dependencies installed successfully"

# Create environment file
echo "🔧 Setting up environment configuration..."
if [ ! -f ".env.local" ]; then
    cp .env.example .env.local
    echo "✅ Created .env.local from template"
    echo "⚠️  Please edit .env.local and add your API keys:"
    echo "   - OPENAI_API_KEY"
    echo "   - PINECONE_API_KEY"
    echo "   - PINECONE_ENVIRONMENT"
    echo "   - PINECONE_INDEX"
else
    echo "ℹ️  .env.local already exists"
fi

# Create directories
echo "📁 Creating project directories..."
mkdir -p components lib pages/api types utils public

# Build the project
echo "🔨 Building the project..."
npm run build

if [ $? -eq 0 ]; then
    echo "✅ Build successful!"
else
    echo "⚠️  Build failed, but setup continues..."
fi

echo ""
echo "🎉 Setup completed!"
echo ""
echo "Next steps:"
echo "1. Edit .env.local with your API keys"
echo "2. Run 'npm run dev' to start development server"
echo "3. Open http://localhost:3000 in your browser"
echo ""
echo "API Keys needed:"
echo "- OpenAI API Key: https://platform.openai.com/api-keys"
echo "- Pinecone API Key: https://app.pinecone.io/"
echo ""
echo "📚 Documentation: See README.md for detailed setup instructions"