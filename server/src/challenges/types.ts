/**
 * Challenge Types
 * 
 * Defines the challenge type and answer structures.
 * Currently only 'coherent' is supported - the only type that truly requires AI.
 */

// Challenge type - coherent is the only type that can't be pre-scripted
export type ChallengeType = 'coherent';

// Client answer type
export interface ChallengeAnswer {
  type?: ChallengeType;
  challengeId: string;
  answer: string;
  nonce?: string; // Legacy compatibility
}

// Server message for challenge
export interface ChallengePayload {
  type: ChallengeType;
  challengeId: string;
  timeoutMs: number;
  words?: string[];
  wordCount?: number;
  instruction?: string;
}
