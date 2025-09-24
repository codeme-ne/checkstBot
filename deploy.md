# CheckstBot Vercel Deployment Guide

## 🚀 Quick Deploy to Vercel

### Method 1: Vercel CLI (Recommended)

1. **Install Vercel CLI globally:**
```bash
npm install -g vercel
```

2. **Login to Vercel:**
```bash
vercel login
```

3. **Deploy from your project directory:**
```bash
vercel --prod
```

### Method 2: GitHub Integration (Easiest)

1. **Go to [Vercel Dashboard](https://vercel.com/dashboard)**
2. **Click "New Project"**
3. **Import your GitHub repository:** `https://github.com/codeme-ne/checkstBot`
4. **Configure as shown below**

## 📋 Required Environment Variables for Production

Set these in your Vercel dashboard under **Settings → Environment Variables**:

### Core Required Variables:
```env
OPENAI_API_KEY=sk-proj-your-actual-openai-key-here
PINECONE_API_KEY=your-actual-pinecone-key-here
PINECONE_ENVIRONMENT=us-east-1
PINECONE_INDEX=checkstbot-index
```

### Recommended Additional Variables:
```env
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_DIMENSIONS=1536
NEXT_PUBLIC_APP_URL=https://your-domain.vercel.app
MAX_FILE_SIZE=10485760
CHUNK_SIZE=1000
CHUNK_OVERLAP=200
NODE_ENV=production
LOG_LEVEL=info
```

### Optional (for future multi-model support):
```env
ANTHROPIC_API_KEY=your-anthropic-key-here
GOOGLE_AI_API_KEY=your-google-ai-key-here
```

## ⚙️ Vercel Project Settings

### Build Settings:
- **Framework Preset:** Next.js
- **Root Directory:** `./` (leave empty if deploying from root)
- **Build Command:** `npm run build`
- **Install Command:** `npm ci`
- **Output Directory:** `.next`

### Function Settings:
- **Node.js Version:** 18.x or 20.x
- **Regions:** US East (Virginia) - `iad1` for best OpenAI API performance

## 🔐 Security Configuration

Your deployment includes:
- ✅ CSRF protection
- ✅ Rate limiting
- ✅ XSS protection with DOMPurify
- ✅ Security headers (CSP, Frame Options, etc.)
- ✅ Environment variable protection

## 🌐 Custom Domain Setup (Optional)

1. **In Vercel Dashboard:**
   - Go to your project → Domains
   - Add your custom domain
   - Follow DNS configuration instructions

2. **Update environment variable:**
   ```env
   NEXT_PUBLIC_APP_URL=https://your-custom-domain.com
   ```

## 🔍 Post-Deployment Verification

After deployment, test these endpoints:

1. **Main App:** `https://your-domain.vercel.app`
2. **Health Check:** `https://your-domain.vercel.app/api/csrf`
3. **Upload Test:** Upload a test document
4. **Chat Test:** Ask a question about the uploaded document

## 📊 Monitoring & Analytics

Enable in Vercel Dashboard:
- **Analytics:** Monitor page performance
- **Speed Insights:** Track Core Web Vitals
- **Function Logs:** Debug API issues

## 🚨 Common Issues & Solutions

### Build Failures:
- Ensure all environment variables are set
- Check that Node.js version is 18.17.0+
- Verify no TypeScript errors: `npm run type-check`

### API Timeouts:
- Vercel free tier has 10s function timeout
- Consider Vercel Pro for 30s timeout on larger documents

### File Upload Issues:
- Vercel has 4.5MB request limit on Hobby plan
- Files are processed in memory, consider chunking for very large files

## 📝 Environment-Specific Considerations

### Development vs Production:
- **Dev:** Uses `localhost:3000` for API calls
- **Production:** Uses full domain URLs
- **Caching:** Production enables aggressive caching
- **Logging:** Production reduces log verbosity

### Performance Optimizations:
- Static assets cached for 1 year
- API responses cached appropriately
- Images optimized automatically
- Gzip compression enabled

## 🎯 Success Metrics

Your deployment is successful when:
- ✅ Build completes without errors
- ✅ All pages load correctly
- ✅ Document upload works
- ✅ RAG chat responses generate properly
- ✅ No console errors in browser
- ✅ Fast loading times (< 3s initial load)

---

**Need help?** Check Vercel logs in your dashboard or contact support if issues persist.