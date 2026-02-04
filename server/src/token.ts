/**
 * Token Generation and Validation
 * 
 * Tokens are issued after successful challenge verification
 * and can be validated by backend services
 */

import type { Config, TokenStore, VerificationToken, ValidateResponse } from './types';

// In-memory token store
class MemoryTokenStore implements TokenStore {
  private tokens = new Map<string, VerificationToken>();
  
  set(token: string, data: VerificationToken): void {
    this.tokens.set(token, data);
  }
  
  get(token: string): VerificationToken | undefined {
    return this.tokens.get(token);
  }
  
  delete(token: string): boolean {
    return this.tokens.delete(token);
  }
  
  cleanup(): void {
    const now = Date.now();
    for (const [token, data] of this.tokens) {
      if (data.expiresAt < now) {
        this.tokens.delete(token);
      }
    }
  }
}

// Singleton store instance
export const tokenStore: TokenStore = new MemoryTokenStore();

/**
 * Generate a cryptographically secure token
 */
function generateTokenString(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  
  // Create a URL-safe base64 string
  const base64 = btoa(String.fromCharCode(...bytes));
  const urlSafe = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  
  return `rcap_${urlSafe}`;
}

/**
 * Create a new verification token
 */
export function createToken(
  config: Config,
  challengeId: string,
  clientIp?: string
): VerificationToken {
  const now = Date.now();
  
  const tokenData: VerificationToken = {
    token: generateTokenString(),
    challengeId,
    issuedAt: now,
    expiresAt: now + config.tokenExpiryMs,
    clientIp,
  };
  
  tokenStore.set(tokenData.token, tokenData);
  
  return tokenData;
}

/**
 * Validate a token
 * Returns validation result with details
 */
export function validateToken(token: string): ValidateResponse {
  if (!token || typeof token !== 'string') {
    return {
      valid: false,
      error: 'Token is required',
    };
  }
  
  // Check token format
  if (!token.startsWith('rcap_')) {
    return {
      valid: false,
      error: 'Invalid token format',
    };
  }
  
  const tokenData = tokenStore.get(token);
  
  if (!tokenData) {
    return {
      valid: false,
      error: 'Token not found or already used',
    };
  }
  
  // Check expiry
  if (Date.now() > tokenData.expiresAt) {
    tokenStore.delete(token);
    return {
      valid: false,
      error: 'Token expired',
    };
  }
  
  // Token is valid - delete it (single use)
  tokenStore.delete(token);
  
  return {
    valid: true,
    challengeId: tokenData.challengeId,
    expiresAt: tokenData.expiresAt,
  };
}

/**
 * Check if a token is valid without consuming it
 * Useful for status checks
 */
export function isTokenValid(token: string): boolean {
  const tokenData = tokenStore.get(token);
  
  if (!tokenData) return false;
  if (Date.now() > tokenData.expiresAt) {
    tokenStore.delete(token);
    return false;
  }
  
  return true;
}

/**
 * Get token info without consuming it
 */
export function getTokenInfo(token: string): VerificationToken | undefined {
  const tokenData = tokenStore.get(token);
  
  if (!tokenData) return undefined;
  if (Date.now() > tokenData.expiresAt) {
    tokenStore.delete(token);
    return undefined;
  }
  
  return tokenData;
}

/**
 * Cleanup expired tokens (call periodically)
 */
export function cleanupTokens(): void {
  tokenStore.cleanup();
}

// Run cleanup every 10 seconds for faster memory reclamation
setInterval(cleanupTokens, 10_000);
