import { describe, it, expect } from 'bun:test';
import {
  generateChallenge,
  challengeToPayload,
  getChallenge,
  consumeChallenge,
} from '../challenges';
import { generateCoherentChallenge, MAX_SENTENCE_LENGTH } from '../challenges/coherent';
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

describe('Challenge Module', () => {
  describe('generateCoherentChallenge', () => {
    it('should generate challenge with 5 words', () => {
      const challenge = generateCoherentChallenge();

      expect(challenge.words).toHaveLength(5);
      expect(challenge.words.every(w => typeof w === 'string')).toBe(true);
    });

    it('should generate word count between 15 and 25', () => {
      for (let i = 0; i < 20; i++) {
        const challenge = generateCoherentChallenge();
        expect(challenge.wordCount).toBeGreaterThanOrEqual(15);
        expect(challenge.wordCount).toBeLessThanOrEqual(25);
      }
    });

    it('should have timeout value', () => {
      const challenge = generateCoherentChallenge();
      expect(challenge.timeoutMs).toBeGreaterThan(0);
    });
  });

  describe('generateChallenge', () => {
    it('should create challenge with unique ID', () => {
      const challenge1 = generateChallenge(mockConfig, '127.0.0.1');
      const challenge2 = generateChallenge(mockConfig, '127.0.0.1');

      expect(challenge1.id).not.toBe(challenge2.id);
      expect(challenge1.id).toStartWith('ch_');
      expect(challenge2.id).toStartWith('ch_');
    });

    it('should set correct type', () => {
      const challenge = generateChallenge(mockConfig, '127.0.0.1');
      expect(challenge.type).toBe('coherent');
    });

    it('should set expiry time', () => {
      const before = Date.now();
      const challenge = generateChallenge(mockConfig, '127.0.0.1');
      const after = Date.now();

      expect(challenge.expiresAt).toBeGreaterThanOrEqual(before + mockConfig.challengeTimeoutMs);
      expect(challenge.expiresAt).toBeLessThanOrEqual(after + mockConfig.challengeTimeoutMs);
    });

    it('should store challenge for retrieval', () => {
      const challenge = generateChallenge(mockConfig, '127.0.0.1');
      const retrieved = getChallenge(challenge.id);

      expect(retrieved).not.toBeUndefined();
      expect(retrieved?.id).toBe(challenge.id);
    });
  });

  describe('challengeToPayload', () => {
    it('should return words and word count', () => {
      const challenge = generateChallenge(mockConfig, '127.0.0.1');
      const payload = challengeToPayload(challenge, mockConfig.challengeTimeoutMs);

      expect(payload.words).toEqual(challenge.data.words);
      expect(payload.wordCount).toBe(challenge.data.wordCount);
    });

    it('should include instruction', () => {
      const challenge = generateChallenge(mockConfig, '127.0.0.1');
      const payload = challengeToPayload(challenge, mockConfig.challengeTimeoutMs);

      expect(payload.instruction).toContain('sentence');
      expect(payload.instruction).toContain(String(challenge.data.wordCount));
    });
  });

  describe('consumeChallenge', () => {
    it('should remove challenge after consumption', () => {
      const challenge = generateChallenge(mockConfig, '127.0.0.1');

      expect(getChallenge(challenge.id)).not.toBeUndefined();

      const consumed = consumeChallenge(challenge.id);
      expect(consumed).toBe(true);

      expect(getChallenge(challenge.id)).toBeUndefined();
    });

    it('should return false for non-existent challenge', () => {
      const consumed = consumeChallenge('non-existent-id');
      expect(consumed).toBe(false);
    });
  });

  describe('MAX_SENTENCE_LENGTH', () => {
    it('should be defined and reasonable', () => {
      expect(MAX_SENTENCE_LENGTH).toBe(10000);
    });
  });
});
