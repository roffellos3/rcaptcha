import { describe, it, expect } from 'bun:test';
import { generateCoherentChallenge, verifyCoherent, MAX_SENTENCE_LENGTH } from '../challenges/coherent';

describe('Coherent Challenge', () => {
  describe('generateCoherentChallenge', () => {
    it('should generate 5 unique words', () => {
      const challenge = generateCoherentChallenge();
      const uniqueWords = new Set(challenge.words);

      expect(challenge.words).toHaveLength(5);
      expect(uniqueWords.size).toBe(5);
    });

    it('should generate words from expected categories', () => {
      const challenge = generateCoherentChallenge();

      // All words should be lowercase strings
      challenge.words.forEach(word => {
        expect(typeof word).toBe('string');
        expect(word.length).toBeGreaterThan(0);
      });
    });
  });

  describe('verifyCoherent', () => {
    it('should reject empty sentence', async () => {
      const challenge = generateCoherentChallenge();
      const result = await verifyCoherent(challenge, { sentence: '' });

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Empty'))).toBe(true);
    });

    it('should reject sentence missing words', async () => {
      const challenge = {
        words: ['apple', 'banana', 'cherry', 'date', 'elderberry'],
        wordCount: 10,
        timeoutMs: 9000,
      };

      const result = await verifyCoherent(challenge, {
        sentence: 'This is a sentence without required words here now.',
      });

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Missing words'))).toBe(true);
    });

    it('should reject sentence with wrong word count', async () => {
      const challenge = {
        words: ['apple', 'banana', 'cherry', 'date', 'elderberry'],
        wordCount: 20,
        timeoutMs: 9000,
      };

      const result = await verifyCoherent(challenge, {
        sentence: 'The apple and banana with cherry date elderberry.',
      });

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Word count'))).toBe(true);
    });

    it('should reject sentence without capital start', async () => {
      const challenge = {
        words: ['apple', 'test', 'word', 'here', 'now'],
        wordCount: 8,
        timeoutMs: 9000,
      };

      const result = await verifyCoherent(challenge, {
        sentence: 'apple test word here now is good today.',
      });

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('capital'))).toBe(true);
    });

    it('should reject sentence without ending punctuation', async () => {
      const challenge = {
        words: ['apple', 'test', 'word', 'here', 'now'],
        wordCount: 8,
        timeoutMs: 9000,
      };

      const result = await verifyCoherent(challenge, {
        sentence: 'Apple test word here now is good today',
      });

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('punctuation'))).toBe(true);
    });

    it('should reject sentence that is too long', async () => {
      const challenge = generateCoherentChallenge();
      const longSentence = 'a'.repeat(MAX_SENTENCE_LENGTH + 1);

      const result = await verifyCoherent(challenge, { sentence: longSentence });

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('too long'))).toBe(true);
    });
  });
});
