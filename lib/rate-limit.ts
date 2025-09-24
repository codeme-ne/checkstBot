import type { NextApiRequest, NextApiResponse } from 'next';

interface RateLimitEntry {
  count: number;
  resetTime: number;
  lastAccess: number; // For LRU eviction
}

interface RateLimitStore {
  [key: string]: RateLimitEntry;
}

const store: RateLimitStore = {};
const MAX_ENTRIES = 10000; // Maximum number of tracked clients

export interface RateLimitConfig {
  windowMs?: number; // Time window in milliseconds
  max?: number; // Max requests per window
  message?: string; // Error message
}

const defaultConfig: RateLimitConfig = {
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute
  message: 'Too many requests, please try again later.'
};

function getClientIdentifier(req: NextApiRequest): string {
  // Only trust proxy headers if we're behind a known reverse proxy
  const trustProxy = process.env.TRUST_PROXY === 'true';

  let ip: string | undefined;

  if (trustProxy && req.headers['x-forwarded-for']) {
    // When behind a trusted proxy, use the first IP in the chain
    const forwarded = req.headers['x-forwarded-for'];
    const ips = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    // Take the first IP (original client) from comma-separated list
    ip = ips.split(',')[0].trim();
  } else if (trustProxy && req.headers['x-real-ip']) {
    // Alternative header used by some proxies
    const realIp = req.headers['x-real-ip'];
    ip = Array.isArray(realIp) ? realIp[0] : realIp;
  } else {
    // Direct connection or untrusted proxy - use socket address
    ip = req.socket.remoteAddress;
  }

  // Fallback to session ID or generate a unique identifier if IP is not available
  if (!ip || ip === 'unknown') {
    // In production, consider using session-based identification
    const sessionId = req.cookies?.sessionId || 'anonymous';
    return `session-${sessionId}`;
  }

  return ip;
}

function evictLRUEntries() {
  const entries = Object.entries(store);

  // If we're at or above 90% capacity, evict the least recently used entries
  if (entries.length >= MAX_ENTRIES * 0.9) {
    // Sort by lastAccess time (oldest first)
    entries.sort((a, b) => a[1].lastAccess - b[1].lastAccess);

    // Remove the oldest 10% of entries
    const entriesToRemove = Math.floor(MAX_ENTRIES * 0.1);
    for (let i = 0; i < entriesToRemove && i < entries.length; i++) {
      delete store[entries[i][0]];
    }
  }
}

export function rateLimit(config: RateLimitConfig = {}) {
  const options = { ...defaultConfig, ...config };

  return (handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>) => {
    return async (req: NextApiRequest, res: NextApiResponse) => {
      const clientId = getClientIdentifier(req);
      const now = Date.now();

      // Clean up expired entries
      let expiredCount = 0;
      for (const [key, value] of Object.entries(store)) {
        if (value.resetTime < now) {
          delete store[key];
          expiredCount++;
          // Limit cleanup to prevent DoS via cleanup
          if (expiredCount > 100) break;
        }
      }

      // Check if we need to evict LRU entries
      if (Object.keys(store).length >= MAX_ENTRIES) {
        evictLRUEntries();
      }

      // Initialize or get client data
      if (!store[clientId] || store[clientId].resetTime < now) {
        store[clientId] = {
          count: 0,
          resetTime: now + options.windowMs!,
          lastAccess: now
        };
      }

      const clientData = store[clientId];
      clientData.lastAccess = now; // Update access time

      // Check if limit exceeded
      if (clientData.count >= options.max!) {
        res.status(429).json({ error: options.message });
        return;
      }

      // Increment counter
      clientData.count++;

      // Add rate limit headers
      res.setHeader('X-RateLimit-Limit', options.max!.toString());
      res.setHeader('X-RateLimit-Remaining', (options.max! - clientData.count).toString());
      res.setHeader('X-RateLimit-Reset', clientData.resetTime.toString());

      // Call the handler
      return handler(req, res);
    };
  };
}

// Utility function to get rate limiter stats (useful for monitoring)
export function getRateLimiterStats() {
  const now = Date.now();
  const activeEntries = Object.values(store).filter(entry => entry.resetTime > now).length;

  return {
    totalEntries: Object.keys(store).length,
    activeEntries,
    maxEntries: MAX_ENTRIES,
    utilizationPercent: (Object.keys(store).length / MAX_ENTRIES) * 100
  };
}