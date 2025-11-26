import crypto from 'crypto';
import type { NextApiRequest, NextApiResponse } from 'next';

const CSRF_HEADER = 'x-csrf-token';
const CSRF_COOKIE = 'csrf-token';

export function generateCSRFToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function getCSRFToken(req: NextApiRequest): string | undefined {
  const headerToken = req.headers[CSRF_HEADER];
  return Array.isArray(headerToken) ? headerToken[0] : headerToken;
}

export function validateCSRFToken(req: NextApiRequest): boolean {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return true;
  }

  const token = getCSRFToken(req);
  const sessionToken = req.cookies[CSRF_COOKIE];

  if (!token || !sessionToken) {
    return false;
  }

  const tokenBuffer = Buffer.from(token);
  const sessionBuffer = Buffer.from(sessionToken);

  // Prevent timing leak from different length buffers
  if (tokenBuffer.length !== sessionBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(tokenBuffer, sessionBuffer);
}

export function withCSRFProtection(
  handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>
) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    if (!validateCSRFToken(req)) {
      res.status(403).json({ error: 'Invalid CSRF token' });
      return;
    }

    return handler(req, res);
  };
}