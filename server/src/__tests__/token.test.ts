import { describe, it, expect, beforeEach } from 'bun:test';
import { createToken, validateToken, tokenStore } from '../token';
import type { Config } from '../types';

const mockConfig: Config = {
  port: 9816,
  challengeTimeoutMs: 9000,
  tokenExpiryMs: 60000,
  corsOrigins: ['http://localhost:3000'],
  rateLimitEnabled: true,
  rateLimitStartPerMin: 10,
  rateLimitSubmitPerMin: 30,
  rateLimitWindowMs: 60000,
  loggingEnabled: false,
  logLevel: 'error',
};

describe('Token Module', () => {
  describe('createToken', () => {
    it('should create a token with correct format', () => {
      const token = createToken(mockConfig, 'test-challenge-id', '127.0.0.1');

      expect(token.token).toStartWith('rcap_');
      expect(token.challengeId).toBe('test-challenge-id');
      expect(token.clientIp).toBe('127.0.0.1');
      expect(token.issuedAt).toBeLessThanOrEqual(Date.now());
      expect(token.expiresAt).toBeGreaterThan(Date.now());
    });

    it('should set correct expiry time', () => {
      const before = Date.now();
      const token = createToken(mockConfig, 'test-challenge-id');
      const after = Date.now();

      expect(token.expiresAt).toBeGreaterThanOrEqual(before + mockConfig.tokenExpiryMs);
      expect(token.expiresAt).toBeLessThanOrEqual(after + mockConfig.tokenExpiryMs);
    });
  });

  describe('validateToken', () => {
    it('should validate a valid token', () => {
      const tokenData = createToken(mockConfig, 'test-challenge-id');
      const result = validateToken(tokenData.token);

      expect(result.valid).toBe(true);
      expect(result.challengeId).toBe('test-challenge-id');
    });

    it('should reject invalid token format', () => {
      const result = validateToken('invalid-token');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid token format');
    });

    it('should reject empty token', () => {
      const result = validateToken('');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Token is required');
    });

    it('should reject non-existent token', () => {
      const result = validateToken('rcap_nonexistent');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Token not found or already used');
    });

    it('should consume token after validation (single use)', () => {
      const tokenData = createToken(mockConfig, 'test-challenge-id');

      const firstValidation = validateToken(tokenData.token);
      expect(firstValidation.valid).toBe(true);

      const secondValidation = validateToken(tokenData.token);
      expect(secondValidation.valid).toBe(false);
      expect(secondValidation.error).toBe('Token not found or already used');
    });
  });
});
