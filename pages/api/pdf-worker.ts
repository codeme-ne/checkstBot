import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs/promises';

let cachedWorkerSource: string | null = null;

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  try {
    if (!cachedWorkerSource) {
      const workerPath = require.resolve('pdfjs-dist/build/pdf.worker.min.mjs');
      cachedWorkerSource = await fs.readFile(workerPath, 'utf8');
    }

    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    return res.status(200).send(cachedWorkerSource);
  } catch (error) {
    console.error('Failed to load PDF worker source:', error);
    return res.status(500).json({ error: 'PDF worker unavailable' });
  }
}
