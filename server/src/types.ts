/**
 * rCAPTCHA Server Types
 */

// Re-export challenge types
export type { 
  ChallengeType,
  ChallengeAnswer,
  ChallengePayload,
} from './challenges/types';

// Token issued after successful verification
export interface VerificationToken {
  token: string;
  challengeId: string;
  issuedAt: number;
  expiresAt: number;
  clientIp?: string;
}

import type { ChallengeType, ChallengePayload } from './challenges/types';

// WebSocket messages from server to client
export interface ServerMessage {
  type: 'challenge' | 'result' | 'error' | 'timeout';
  challengeId?: string;
  challengeType?: ChallengeType;
  
  // Challenge payload fields
  words?: string[];
  wordCount?: number;
  instruction?: string;
  
  timeoutMs?: number;
  success?: boolean;
  token?: string;
  message?: string;
}

// WebSocket messages from client to server
export interface ClientMessage {
  type: 'verify';
  challengeId: string;
  challengeType?: ChallengeType;
  answer?: string;
  nonce?: string; // Legacy compatibility
  robotsTxtContent?: string; // Legacy compatibility
}

// HTTP validation request body
export interface ValidateRequest {
  token: string;
}

// HTTP validation response
export interface ValidateResponse {
  valid: boolean;
  challengeId?: string;
  expiresAt?: number;
  error?: string;
}

// Environment configuration
export interface Config {
  port: number;
  challengeTimeoutMs: number;
  tokenExpiryMs: number;
  corsOrigins: string[];

  // Rate limiting
  rateLimitEnabled: boolean;
  rateLimitStartPerMin: number;
  rateLimitSubmitPerMin: number;
  rateLimitWindowMs: number;

  // Logging
  loggingEnabled: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

// Token store interface
export interface TokenStore {
  set(token: string, data: VerificationToken): void;
  get(token: string): VerificationToken | undefined;
  delete(token: string): boolean;
  cleanup(): void;
}
