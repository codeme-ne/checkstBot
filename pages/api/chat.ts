import type { NextApiRequest, NextApiResponse } from 'next';
import { ragSystem, ChatMessage } from '../../lib/rag';
import { withCSRFProtection } from '../../lib/csrf';
import { rateLimit } from '../../lib/rate-limit';

type Data = {
  response: string;
};

async function chatHandler(
  req: NextApiRequest,
  res: NextApiResponse<Data | { error: string }>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    return;
  }

  const { message, chatHistory, documentId } = req.body;

  // Validate input
  if (!message || typeof message !== 'string') {
    res.status(400).json({ error: 'Message is required and must be a string' });
    return;
  }

  if (message.trim().length === 0) {
    res.status(400).json({ error: 'Message cannot be empty' });
    return;
  }

  if (message.length > 4000) {
    res.status(400).json({ error: 'Message is too long (max 4000 characters)' });
    return;
  }

  // Validate chatHistory if provided
  if (chatHistory !== undefined && !Array.isArray(chatHistory)) {
    res.status(400).json({ error: 'chatHistory must be an array' });
    return;
  }

  // Validate documentId if provided
  if (documentId !== undefined && typeof documentId !== 'string') {
    res.status(400).json({ error: 'documentId must be a string' });
    return;
  }

  try {
    // Check if documents are available before processing query
    const hasDocuments = await ragSystem.hasDocuments();
    if (!hasDocuments) {
      res.status(400).json({
        error: 'Bitte laden Sie zuerst ein Dokument hoch, bevor Sie Fragen stellen.'
      });
      return;
    }

    // Pass documentId to the RAG system for context-aware responses
    const ragResponse = await ragSystem.query(message, chatHistory || [], documentId);
    res.status(200).json({ response: ragResponse.answer });
  } catch (error) {
    console.error('Error in RAG query:', error);

    // Provide more specific error messages
    if (error instanceof Error) {
      if (error.message.includes('rate limit')) {
        res.status(429).json({ error: 'Too many requests. Please try again later.' });
      } else if (error.message.includes('context')) {
        res.status(400).json({ error: 'Unable to find relevant context. Please upload a document first.' });
      } else {
        res.status(500).json({ error: 'An error occurred while processing your request.' });
      }
    } else {
      res.status(500).json({ error: 'An unexpected error occurred.' });
    }
  }
}

// Apply rate limiting (10 requests per minute) and CSRF protection
const handler = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute
  message: 'Too many chat requests. Please wait a moment before trying again.'
})(chatHandler);

export default withCSRFProtection(handler);
