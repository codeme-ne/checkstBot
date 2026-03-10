import type { NextApiRequest, NextApiResponse } from 'next';
import { ragSystem } from '../../lib/rag';
import { withCSRFProtection } from '../../lib/csrf';
import { rateLimit } from '../../lib/rate-limit';

type SummaryResponse =
  | {
      summary: string;
      generatedAt: string;
    }
  | { error: string };

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '8mb',
    },
  },
};

async function summaryHandler(
  req: NextApiRequest,
  res: NextApiResponse<SummaryResponse>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    return;
  }

  const { documentId, title, content } = req.body ?? {};

  if (!documentId || typeof documentId !== 'string') {
    res.status(400).json({ error: 'documentId is required and must be a string' });
    return;
  }

  if (!title || typeof title !== 'string') {
    res.status(400).json({ error: 'title is required and must be a string' });
    return;
  }

  if (!content || typeof content !== 'string') {
    res.status(400).json({ error: 'content is required and must be a string' });
    return;
  }

  if (content.trim().length < 40) {
    res.status(400).json({ error: 'Document content is too short for a structured summary' });
    return;
  }

  try {
    const summary = await ragSystem.summarizeDocumentContent(title, content);
    res.status(200).json({
      summary,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error generating summary:', error);
    res.status(502).json({
      error: 'Die Zusammenfassung konnte nicht generiert werden. Bitte versuchen Sie es erneut.',
    });
  }
}

const handler = rateLimit({
  windowMs: 60 * 1000,
  max: 6,
  message: 'Too many summary requests. Please wait a moment before trying again.',
})(summaryHandler);

export default withCSRFProtection(handler);
