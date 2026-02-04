/**
 * Rate Limiting Module
 *
 * Token bucket algorithm for per-IP rate limiting.
 * Configurable limits for different endpoint categories.
 */

export interface RateLimitConfig {
  maxTokens: number;      // Maximum tokens in bucket
  refillRate: number;     // Tokens added per second
  refillInterval: number; // How often to refill (ms)
}

interface TokenBucket {
  tokens: number;
  lastRefill: number;
}

// Rate limit stores for different endpoint categories
const challengeStore = new Map<string, TokenBucket>();  // /challenge, /auth/start
const submitStore = new Map<string, TokenBucket>();     // /auth/submit

// Default configurations (per minute)
export const RATE_LIMITS = {
  // /challenge and /auth/start: 10 requests per minute
  challenge: {
    maxTokens: 10,
    refillRate: 10 / 60,  // 10 per minute = ~0.167 per second
    refillInterval: 1000,
  } as RateLimitConfig,

  // /auth/submit: 30 requests per minute
  submit: {
    maxTokens: 30,
    refillRate: 30 / 60,  // 30 per minute = 0.5 per second
    refillInterval: 1000,
  } as RateLimitConfig,
};

/**
 * Get or create a token bucket for an IP
 */
function getBucket(store: Map<string, TokenBucket>, ip: string, config: RateLimitConfig): TokenBucket {
  let bucket = store.get(ip);

  if (!bucket) {
    bucket = {
      tokens: config.maxTokens,
      lastRefill: Date.now(),
    };
    store.set(ip, bucket);
  }

  return bucket;
}

/**
 * Refill tokens based on elapsed time
 */
function refillBucket(bucket: TokenBucket, config: RateLimitConfig): void {
  const now = Date.now();
  const elapsed = now - bucket.lastRefill;
  const tokensToAdd = (elapsed / 1000) * config.refillRate;

  bucket.tokens = Math.min(config.maxTokens, bucket.tokens + tokensToAdd);
  bucket.lastRefill = now;
}

/**
 * Check if request is allowed and consume a token
 * Returns true if allowed, false if rate limited
 */
export function checkRateLimit(
  store: Map<string, TokenBucket>,
  ip: string,
  config: RateLimitConfig
): { allowed: boolean; retryAfterMs?: number } {
  const bucket = getBucket(store, ip, config);
  refillBucket(bucket, config);

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    return { allowed: true };
  }

  // Calculate retry-after time
  const tokensNeeded = 1 - bucket.tokens;
  const retryAfterMs = Math.ceil((tokensNeeded / config.refillRate) * 1000);

  return { allowed: false, retryAfterMs };
}

/**
 * Check rate limit for challenge endpoints (/challenge, /auth/start)
 */
export function checkChallengeRateLimit(ip: string): { allowed: boolean; retryAfterMs?: number } {
  return checkRateLimit(challengeStore, ip, RATE_LIMITS.challenge);
}

/**
 * Check rate limit for submit endpoints (/auth/submit)
 */
export function checkSubmitRateLimit(ip: string): { allowed: boolean; retryAfterMs?: number } {
  return checkRateLimit(submitStore, ip, RATE_LIMITS.submit);
}

/**
 * Get rate limit stats for an IP
 */
export function getRateLimitStats(ip: string): {
  challenge: { tokens: number; maxTokens: number };
  submit: { tokens: number; maxTokens: number };
} {
  const challengeBucket = challengeStore.get(ip);
  const submitBucket = submitStore.get(ip);

  return {
    challenge: {
      tokens: challengeBucket ? Math.floor(challengeBucket.tokens) : RATE_LIMITS.challenge.maxTokens,
      maxTokens: RATE_LIMITS.challenge.maxTokens,
    },
    submit: {
      tokens: submitBucket ? Math.floor(submitBucket.tokens) : RATE_LIMITS.submit.maxTokens,
      maxTokens: RATE_LIMITS.submit.maxTokens,
    },
  };
}

/**
 * Cleanup old buckets (call periodically)
 * Removes buckets that have been full for > 5 minutes
 */
export function cleanupRateLimitStores(): void {
  const now = Date.now();
  const staleThreshold = 5 * 60 * 1000; // 5 minutes

  for (const store of [challengeStore, submitStore]) {
    for (const [ip, bucket] of store) {
      refillBucket(bucket, RATE_LIMITS.challenge);
      // If bucket is full and hasn't been used recently, remove it
      if (bucket.tokens >= RATE_LIMITS.challenge.maxTokens &&
          now - bucket.lastRefill > staleThreshold) {
        store.delete(ip);
      }
    }
  }
}

// Cleanup every 30 seconds
setInterval(cleanupRateLimitStores, 30_000);

/**
 * Create rate limit response
 */
export function rateLimitResponse(retryAfterMs: number, corsHeaders: Record<string, string>): Response {
  const retryAfterSeconds = Math.ceil(retryAfterMs / 1000);

  return new Response(
    JSON.stringify({
      error: 'Too many requests',
      retryAfter: retryAfterSeconds,
    }),
    {
      status: 429,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Retry-After': String(retryAfterSeconds),
      },
    }
  );
}
