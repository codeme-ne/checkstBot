import type { NextApiRequest, NextApiResponse } from 'next';
import { generateCSRFToken } from '../../lib/csrf';
import { serialize } from 'cookie';

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    return;
  }

  const token = generateCSRFToken();

  // Set both httpOnly cookie (for server validation) and non-httpOnly (for client to read)
  const cookies = [
    serialize('csrf-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24, // 24 hours
      path: '/'
    }),
    serialize('csrf-token-client', token, {
      httpOnly: false, // Client needs to read this
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24, // 24 hours
      path: '/'
    })
  ];

  res.setHeader('Set-Cookie', cookies);
  res.status(200).json({ success: true }); // Don't expose token in response
}