import { describe, it, expect } from 'bun:test';
import {
  checkChallengeRateLimit,
  checkSubmitRateLimit,
  getRateLimitStats,
  RATE_LIMITS,
} from '../rateLimit';

describe('Rate Limit Module', () => {
  describe('RATE_LIMITS', () => {
    it('should have challenge limit of 10 per minute', () => {
      expect(RATE_LIMITS.challenge.maxTokens).toBe(10);
    });

    it('should have submit limit of 30 per minute', () => {
      expect(RATE_LIMITS.submit.maxTokens).toBe(30);
    });
  });

  describe('checkChallengeRateLimit', () => {
    it('should allow requests within limit', () => {
      const testIp = `test-challenge-${Date.now()}`;

      for (let i = 0; i < 10; i++) {
        const result = checkChallengeRateLimit(testIp);
        expect(result.allowed).toBe(true);
      }
    });

    it('should block requests over limit', () => {
      const testIp = `test-challenge-block-${Date.now()}`;

      // Use up all tokens
      for (let i = 0; i < 10; i++) {
        checkChallengeRateLimit(testIp);
      }

      // Next request should be blocked
      const result = checkChallengeRateLimit(testIp);
      expect(result.allowed).toBe(false);
      expect(result.retryAfterMs).toBeGreaterThan(0);
    });
  });

  describe('checkSubmitRateLimit', () => {
    it('should allow requests within limit', () => {
      const testIp = `test-submit-${Date.now()}`;

      for (let i = 0; i < 30; i++) {
        const result = checkSubmitRateLimit(testIp);
        expect(result.allowed).toBe(true);
      }
    });

    it('should block requests over limit', () => {
      const testIp = `test-submit-block-${Date.now()}`;

      // Use up all tokens
      for (let i = 0; i < 30; i++) {
        checkSubmitRateLimit(testIp);
      }

      // Next request should be blocked
      const result = checkSubmitRateLimit(testIp);
      expect(result.allowed).toBe(false);
      expect(result.retryAfterMs).toBeGreaterThan(0);
    });
  });

  describe('getRateLimitStats', () => {
    it('should return stats for IP', () => {
      const testIp = `test-stats-${Date.now()}`;
      checkChallengeRateLimit(testIp);

      const stats = getRateLimitStats(testIp);

      expect(stats.challenge).toHaveProperty('tokens');
      expect(stats.challenge).toHaveProperty('maxTokens');
      expect(stats.submit).toHaveProperty('tokens');
      expect(stats.submit).toHaveProperty('maxTokens');
    });

    it('should return full tokens for unknown IP', () => {
      const testIp = `unknown-ip-${Date.now()}`;
      const stats = getRateLimitStats(testIp);

      expect(stats.challenge.tokens).toBe(RATE_LIMITS.challenge.maxTokens);
      expect(stats.submit.tokens).toBe(RATE_LIMITS.submit.maxTokens);
    });
  });
});
