/**
 * Challenge Router
 * 
 * Unified interface for all challenge types.
 * Currently only supports 'coherent' - the one challenge that truly requires AI.
 */

import type { Config } from '../types';
import type { ChallengeType, ChallengeAnswer } from './types';
import { generateCoherentChallenge, verifyCoherent, type CoherentChallenge } from './coherent';

// Re-export types
export * from './types';
export * from './coherent';

// ============ Unified Types ============

export interface MultiChallenge {
  id: string;
  type: ChallengeType;
  createdAt: number;
  expiresAt: number;
  clientIp?: string;
  verified: boolean;
  data: CoherentChallenge;
}

export interface ChallengePayload {
  words?: string[];
  wordCount?: number;
  instruction?: string;
}

export interface VerifyResult {
  success: boolean;
  error?: string;
}

// ============ In-memory store ============

const challengeStore = new Map<string, MultiChallenge>();

// Max challenges to prevent memory exhaustion
const MAX_CHALLENGES = 10000;

/**
 * Cleanup expired challenges
 */
function cleanupChallenges(): void {
  const now = Date.now();
  for (const [id, challenge] of challengeStore) {
    if (challenge.expiresAt < now) {
      challengeStore.delete(id);
    }
  }

  // Emergency eviction if still over limit (remove oldest first)
  if (challengeStore.size > MAX_CHALLENGES) {
    const sortedChallenges = [...challengeStore.entries()]
      .sort((a, b) => a[1].createdAt - b[1].createdAt);

    const toRemove = challengeStore.size - MAX_CHALLENGES;
    for (let i = 0; i < toRemove; i++) {
      challengeStore.delete(sortedChallenges[i][0]);
    }
  }
}

// Cleanup expired challenges every 10 seconds
setInterval(cleanupChallenges, 10_000);

// ============ Challenge Generation ============

/**
 * Generate a cryptographically secure challenge ID
 */
function generateId(): string {
  const randomBytes = new Uint8Array(12);
  crypto.getRandomValues(randomBytes);
  const randomPart = Array.from(randomBytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  return `ch_${Date.now().toString(36)}_${randomPart}`;
}

/**
 * Generate a challenge (always coherent - the only type that truly requires AI)
 */
export function generateChallenge(config: Config, clientIp?: string): MultiChallenge {
  return generateChallengeOfType('coherent', config, clientIp);
}

/**
 * Generate a challenge of a specific type
 */
export function generateChallengeOfType(type: ChallengeType, config: Config, clientIp?: string): MultiChallenge {
  const id = generateId();
  const now = Date.now();
  const timeoutMs = config?.challengeTimeoutMs || 30000;
  
  const data = generateCoherentChallenge();
  
  const challenge: MultiChallenge = {
    id,
    type: 'coherent',
    createdAt: now,
    expiresAt: now + timeoutMs,
    clientIp,
    verified: false,
    data,
  };
  
  challengeStore.set(id, challenge);
  return challenge;
}

// ============ Challenge Payload (for client) ============

/**
 * Convert a challenge to the payload sent to the client
 */
export function challengeToPayload(challenge: MultiChallenge, timeoutMs: number): ChallengePayload {
  const d = challenge.data as CoherentChallenge;
  return {
    words: d.words,
    wordCount: d.wordCount,
    instruction: `Write a meaningful ${d.wordCount}-word sentence using ALL of these words: ${d.words.join(', ')}`,
  };
}

// ============ Verification ============

/**
 * Verify an answer against a stored challenge
 */
export async function verifyAnswer(challengeId: string, answer: ChallengeAnswer): Promise<VerifyResult> {
  const challenge = challengeStore.get(challengeId);
  
  if (!challenge) {
    return { success: false, error: 'Challenge not found or expired' };
  }
  
  if (challenge.verified) {
    return { success: false, error: 'Challenge already verified' };
  }
  
  if (Date.now() > challenge.expiresAt) {
    challengeStore.delete(challengeId);
    return { success: false, error: 'Challenge expired' };
  }
  
  const d = challenge.data as CoherentChallenge;
  const sentence = answer.answer || '';
  const result = await verifyCoherent(d, { sentence });
  
  if (!result.valid) {
    return { success: false, error: result.errors.join('; ') || 'Sentence not coherent' };
  }
  
  // Mark as verified
  challenge.verified = true;
  return { success: true };
}

// ============ Challenge Management ============

/**
 * Get a stored challenge by ID
 */
export function getChallenge(id: string): MultiChallenge | undefined {
  const challenge = challengeStore.get(id);
  if (!challenge) return undefined;
  if (Date.now() > challenge.expiresAt) {
    challengeStore.delete(id);
    return undefined;
  }
  return challenge;
}

/**
 * Consume (delete) a challenge after successful verification
 */
export function consumeChallenge(id: string): boolean {
  return challengeStore.delete(id);
}

/**
 * List available challenge types
 */
export function listChallengeTypes(): ChallengeType[] {
  return ['coherent'];
}
