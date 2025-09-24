# checkstBot - RAG-Powered Learning Assistant

A sophisticated research learning assistant that combines document processing with conversational AI to help students and researchers interact with their materials more effectively.

## 🎯 Features

- **Smart Document Processing**: Upload and process PDFs, DOCX, TXT, and Markdown files
- **RAG System**: Retrieval-Augmented Generation for contextual responses
- **Multi-LLM Support**: Choose between GPT-4, Claude 3.5, Gemini, and Llama
- **Semantic Search**: Find relevant information using vector embeddings
- **Learning-Optimized**: Structured responses perfect for academic work
- **Text Highlighting**: Select text for specific explanations
- **2-Panel Interface**: Clean document viewer + chat interface

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn
- OpenAI API key
- Pinecone API key

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/codeme-ne/checkstBot.git
cd checkstBot
```

2. **Install dependencies**
```bash
npm install
```

3. **Environment setup**
```bash
cp .env.example .env.local
# Edit .env.local with your API keys
```

4. **Run the development server**
```bash
npm run dev
```

5. **Open your browser**
Navigate to `http://localhost:3000`

## 🛠️ Configuration

### Required API Keys

- **OpenAI API Key**: For embeddings and chat completions
- **Pinecone API Key**: For vector database operations
- **Pinecone Environment**: Your Pinecone environment name
- **Pinecone Index**: Your Pinecone index name

### Environment Variables

```env
OPENAI_API_KEY=sk-your-openai-key-here
PINECONE_API_KEY=your-pinecone-key-here
PINECONE_ENVIRONMENT=your-pinecone-environment
PINECONE_INDEX=your-pinecone-index-name
```

## 📁 Project Structure

```
checkstBot/
├── components/
│   ├── DocumentViewer.tsx    # Document display component
│   ├── ChatInterface.tsx     # Chat interface component
│   └── FileUpload.tsx        # File upload component
├── lib/
│   ├── embedding.ts          # OpenAI embeddings integration
│   ├── rag.ts               # RAG system implementation
│   ├── vector-db.ts         # Pinecone vector database
│   └── document-parser.ts   # Document processing utilities
├── pages/
│   ├── api/
│   │   ├── upload.ts        # File upload endpoint
│   │   ├── chat.ts          # Chat completion endpoint
│   │   └── search.ts        # Semantic search endpoint
│   └── index.tsx            # Main application page
├── styles/                  # Tailwind CSS styles
├── public/                  # Static assets
└── types/                   # TypeScript type definitions
```

## 💡 Usage

1. **Upload Documents**: Drag and drop or select PDF, DOCX, TXT, or MD files
2. **Wait for Processing**: Documents are chunked and embedded automatically
3. **Start Chatting**: Ask questions about your documents
4. **Select Text**: Highlight text for specific explanations
5. **Choose LLM**: Switch between different AI models as needed

## 🔧 Development

### Tech Stack
- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **AI**: OpenAI GPT-4 & Embeddings
- **Vector DB**: Pinecone
- **File Processing**: pdf-parse, mammoth

### Available Scripts
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run type-check   # Run TypeScript checks
```

## 🎓 Educational Use Cases

- **Literature Review**: Upload research papers and ask comparative questions
- **Study Sessions**: Upload textbooks and get chapter summaries
- **Essay Writing**: Get contextual information from your sources
- **Exam Preparation**: Create study guides from course materials
- **Research Analysis**: Extract key insights from academic documents

## 📊 RAG Pipeline

1. **Document Ingestion** → Upload & Parse → Text Extraction
2. **Text Chunking** → Intelligent Segmentation → Overlap Management
3. **Embedding Generation** → OpenAI text-embedding-ada-002 → Vector Creation
4. **Vector Storage** → Pinecone Database → Metadata Indexing
5. **Query Processing** → User Question → Embedding → Similarity Search
6. **Context Retrieval** → Top-K Chunks → Relevance Scoring
7. **Response Generation** → LLM + Context → Structured Answer

## 🚀 Deployment

### Vercel (Recommended)
1. Push to GitHub
2. Connect to Vercel
3. Add environment variables
4. Deploy automatically

### Docker
```bash
docker build -t checkstbot .
docker run -p 3000:3000 checkstbot
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🔗 Links

- [OpenAI API Documentation](https://platform.openai.com/docs)
- [Pinecone Documentation](https://docs.pinecone.io/)
- [Next.js Documentation](https://nextjs.org/docs)

## 🆘 Support

If you encounter any issues:
1. Check the GitHub Issues page
2. Review the environment variable setup
3. Ensure all API keys are valid
4. Check the console for error messages

---

Built with ❤️ for enhanced learning and research