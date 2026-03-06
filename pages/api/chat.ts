import type { NextApiRequest, NextApiResponse } from 'next';
import { ragSystem, ChatMessage } from '../../lib/rag';
import { withCSRFProtection } from '../../lib/csrf';
import { rateLimit } from '../../lib/rate-limit';

type Data = {
  response: string;
  sources?: string[];
};

type SourceLike = {
  metadata?: {
    source?: string;
    chunkIndex?: number;
  };
};

const MAX_RESPONSE_SENTENCES = 3;

function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^>+\s?/gm, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitIntoSentences(text: string): string[] {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return [];
  }

  const parts = normalized.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [];
  return parts.map(part => part.trim()).filter(Boolean);
}

function toConciseAnswer(rawText: string): string {
  const plainText = stripMarkdown(rawText);
  const deEnumerated = plainText
    .replace(/:\s*\d+\.\s*/g, ': ')
    .replace(/\b\d+\.\s+(?=[A-ZÄÖÜ])/g, '');
  const sentences = splitIntoSentences(deEnumerated);

  if (sentences.length === 0) {
    return 'Ich konnte dazu gerade keine klare Antwort erzeugen.';
  }

  return sentences.slice(0, MAX_RESPONSE_SENTENCES).join(' ');
}

function buildSourceLines(sources: SourceLike[] = [], documentId?: string): string[] {
  const deduplicated = new Set<string>();

  for (const source of sources) {
    const sourceName = source.metadata?.source || documentId || 'Dokument';
    const chunkIndex = source.metadata?.chunkIndex;
    const chunkLabel = typeof chunkIndex === 'number' ? `Abschnitt ${chunkIndex + 1}` : null;
    deduplicated.add(chunkLabel ? `${sourceName} (${chunkLabel})` : sourceName);
  }

  const lines = Array.from(deduplicated);
  if (lines.length > 0) {
    return lines.slice(0, 4);
  }

  if (documentId) {
    return [`${documentId} (keine exakte Textstelle erkannt)`];
  }

  return ['Keine eindeutige Textstelle gefunden'];
}

/** Response body only (sources rendered as chips from `sources` array). */
function formatAnswerMarkdown(title: string, answer: string): string {
  return `### ${title}
${answer}`;
}

function extractExplainText(message: string): string | null {
  const prefixPattern = /^Bitte erkläre dieses Zitat präzise und verständlich:\s*/i;

  if (!prefixPattern.test(message)) {
    return null;
  }

  let explainText = message.replace(prefixPattern, '').trim();

  if (
    (explainText.startsWith('"') && explainText.endsWith('"')) ||
    (explainText.startsWith('“') && explainText.endsWith('”'))
  ) {
    explainText = explainText.slice(1, -1).trim();
  }

  return explainText.length > 0 ? explainText : null;
}

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
    const explainText = extractExplainText(message);
    if (explainText) {
      if (explainText.length < 3) {
        res.status(400).json({ error: 'Bitte markieren Sie mehr Text für die Erklärung.' });
        return;
      }

      if (explainText.length > 2000) {
        res.status(400).json({
          error: 'Der markierte Text ist zu lang. Bitte wählen Sie maximal 2000 Zeichen.'
        });
        return;
      }

      const explanation = await ragSystem.explainText(explainText, '', {
        explanationStyle: 'detailed'
      });
      const conciseExplanation = toConciseAnswer(explanation);
      const explainSources = buildSourceLines(
        [{ metadata: { source: documentId || 'Aktuelles Dokument' } }],
        documentId
      );
      res.status(200).json({
        response: formatAnswerMarkdown('Einfache Erklärung', conciseExplanation),
        sources: explainSources
      });
      return;
    }

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
    const conciseAnswer = toConciseAnswer(ragResponse.answer);
    const sourceLines = buildSourceLines(ragResponse.sources, documentId);
    res.status(200).json({
      response: formatAnswerMarkdown('Kurzantwort', conciseAnswer),
      sources: sourceLines
    });
  } catch (error) {
    console.error('Error in RAG query:', error);

    // Provide more specific error messages
    if (error instanceof Error) {
      const lowerMessage = error.message.toLowerCase();

      if (lowerMessage.includes('rate limit') || lowerMessage.includes('429')) {
        res.status(429).json({ error: 'Too many requests. Please try again later.' });
      } else if (lowerMessage.includes('context length') || lowerMessage.includes('token')) {
        res.status(400).json({
          error: 'Die Anfrage ist zu lang. Bitte markieren Sie weniger Text und versuchen Sie es erneut.'
        });
      } else if (lowerMessage.includes('context')) {
        res.status(400).json({ error: 'Unable to find relevant context. Please upload a document first.' });
      } else {
        res.status(502).json({
          error: 'Die Anfrage konnte nicht verarbeitet werden. Bitte versuchen Sie es erneut.'
        });
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
