/**
 * Auth Session Management
 * 
 * Tracks multi-block authentication attempts.
 * Each session goes through up to 3 blocks, each with fresh challenges.
 */

import { generateCoherentChallenge, type CoherentChallenge } from './challenges/coherent';

export interface AuthSession {
  id: string;
  clientIp: string;
  
  // Block progression
  currentBlock: 1 | 2 | 3;
  maxBlocks: 3;
  
  // Current challenge for this block
  challenge: CoherentChallenge & { id: string };
  
  // Timing
  blockStartedAt: number;
  blockTimeoutMs: number;
  sessionCreatedAt: number;
  
  // Status
  status: 'active' | 'passed' | 'failed';
  passedAt?: number;
  failedAt?: number;
}

// In-memory session store (would use Redis in production)
const sessions = new Map<string, AuthSession>();

// Session expiry (cleanup old sessions)
const SESSION_MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes

// Max sessions to prevent memory exhaustion
const MAX_SESSIONS = 10000;

/**
 * Generate a cryptographically secure random string
 */
function secureRandomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const randomBytes = new Uint8Array(length);
  crypto.getRandomValues(randomBytes);

  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(randomBytes[i] % chars.length);
  }
  return result;
}

/**
 * Generate a random session ID (cryptographically secure)
 */
function generateSessionId(): string {
  return `ses_${secureRandomString(24)}`;
}

/**
 * Generate a challenge ID (cryptographically secure)
 */
function generateChallengeId(): string {
  return `ch_${secureRandomString(16)}`;
}

/**
 * Create a new auth session (starts at Block 1)
 */
export function createSession(clientIp: string, blockTimeoutMs: number = 9000): AuthSession {
  const sessionId = generateSessionId();
  const challenge = generateCoherentChallenge();
  const now = Date.now();
  
  const session: AuthSession = {
    id: sessionId,
    clientIp,
    currentBlock: 1,
    maxBlocks: 3,
    challenge: {
      ...challenge,
      id: generateChallengeId(),
    },
    blockStartedAt: now,
    blockTimeoutMs,
    sessionCreatedAt: now,
    status: 'active',
  };
  
  sessions.set(sessionId, session);
  cleanupOldSessions();
  
  return session;
}

/**
 * Get a session by ID
 */
export function getSession(sessionId: string): AuthSession | null {
  return sessions.get(sessionId) || null;
}

/**
 * Check if current block has expired
 */
export function isBlockExpired(session: AuthSession): boolean {
  const elapsed = Date.now() - session.blockStartedAt;
  return elapsed > session.blockTimeoutMs;
}

/**
 * Get remaining time in current block (ms)
 */
export function getBlockTimeRemaining(session: AuthSession): number {
  const elapsed = Date.now() - session.blockStartedAt;
  return Math.max(0, session.blockTimeoutMs - elapsed);
}

/**
 * Advance to next block (returns false if no more blocks)
 */
export function advanceToNextBlock(session: AuthSession): boolean {
  if (session.currentBlock >= session.maxBlocks) {
    session.status = 'failed';
    session.failedAt = Date.now();
    return false;
  }
  
  // Generate fresh challenge for next block
  const newChallenge = generateCoherentChallenge();
  
  session.currentBlock = (session.currentBlock + 1) as 1 | 2 | 3;
  session.challenge = {
    ...newChallenge,
    id: generateChallengeId(),
  };
  session.blockStartedAt = Date.now();
  
  return true;
}

/**
 * Mark session as passed
 */
export function markSessionPassed(session: AuthSession): void {
  session.status = 'passed';
  session.passedAt = Date.now();
}

/**
 * Mark session as failed
 */
export function markSessionFailed(session: AuthSession): void {
  session.status = 'failed';
  session.failedAt = Date.now();
}

/**
 * Delete a session
 */
export function deleteSession(sessionId: string): void {
  sessions.delete(sessionId);
}

/**
 * Clean up old sessions (garbage collection)
 */
function cleanupOldSessions(): void {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now - session.sessionCreatedAt > SESSION_MAX_AGE_MS) {
      sessions.delete(id);
    }
  }

  // Emergency eviction if still over limit (remove oldest first)
  if (sessions.size > MAX_SESSIONS) {
    const sortedSessions = [...sessions.entries()]
      .sort((a, b) => a[1].sessionCreatedAt - b[1].sessionCreatedAt);

    const toRemove = sessions.size - MAX_SESSIONS;
    for (let i = 0; i < toRemove; i++) {
      sessions.delete(sortedSessions[i][0]);
    }
  }
}

// Run cleanup every 30 seconds
setInterval(cleanupOldSessions, 30_000);

/**
 * Get session stats (for debugging)
 */
export function getSessionStats(): { active: number; total: number } {
  let active = 0;
  for (const session of sessions.values()) {
    if (session.status === 'active') active++;
  }
  return { active, total: sessions.size };
}
