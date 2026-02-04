import { describe, it, expect } from 'bun:test';
import {
  createSession,
  getSession,
  isBlockExpired,
  getBlockTimeRemaining,
  advanceToNextBlock,
  markSessionPassed,
  markSessionFailed,
  deleteSession,
  getSessionStats,
} from '../sessions';

describe('Sessions Module', () => {
  describe('createSession', () => {
    it('should create session with unique ID', () => {
      const session1 = createSession('127.0.0.1', 9000);
      const session2 = createSession('127.0.0.1', 9000);

      expect(session1.id).not.toBe(session2.id);
      expect(session1.id).toStartWith('ses_');
      expect(session2.id).toStartWith('ses_');
    });

    it('should start at block 1', () => {
      const session = createSession('127.0.0.1', 9000);
      expect(session.currentBlock).toBe(1);
    });

    it('should have 3 max blocks', () => {
      const session = createSession('127.0.0.1', 9000);
      expect(session.maxBlocks).toBe(3);
    });

    it('should have active status', () => {
      const session = createSession('127.0.0.1', 9000);
      expect(session.status).toBe('active');
    });

    it('should include challenge with words and word count', () => {
      const session = createSession('127.0.0.1', 9000);

      expect(session.challenge.words).toHaveLength(5);
      expect(session.challenge.wordCount).toBeGreaterThanOrEqual(15);
      expect(session.challenge.wordCount).toBeLessThanOrEqual(25);
      expect(session.challenge.id).toStartWith('ch_');
    });
  });

  describe('getSession', () => {
    it('should retrieve existing session', () => {
      const session = createSession('127.0.0.1', 9000);
      const retrieved = getSession(session.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(session.id);
    });

    it('should return null for non-existent session', () => {
      const retrieved = getSession('non-existent-id');
      expect(retrieved).toBeNull();
    });
  });

  describe('isBlockExpired', () => {
    it('should return false for fresh session', () => {
      const session = createSession('127.0.0.1', 9000);
      expect(isBlockExpired(session)).toBe(false);
    });
  });

  describe('getBlockTimeRemaining', () => {
    it('should return positive time for fresh session', () => {
      const session = createSession('127.0.0.1', 9000);
      const remaining = getBlockTimeRemaining(session);

      expect(remaining).toBeGreaterThan(0);
      expect(remaining).toBeLessThanOrEqual(9000);
    });
  });

  describe('advanceToNextBlock', () => {
    it('should advance from block 1 to block 2', () => {
      const session = createSession('127.0.0.1', 9000);
      expect(session.currentBlock).toBe(1);

      const advanced = advanceToNextBlock(session);

      expect(advanced).toBe(true);
      expect(session.currentBlock).toBe(2);
    });

    it('should advance from block 2 to block 3', () => {
      const session = createSession('127.0.0.1', 9000);
      advanceToNextBlock(session);
      expect(session.currentBlock).toBe(2);

      const advanced = advanceToNextBlock(session);

      expect(advanced).toBe(true);
      expect(session.currentBlock).toBe(3);
    });

    it('should fail to advance from block 3', () => {
      const session = createSession('127.0.0.1', 9000);
      advanceToNextBlock(session); // 1 -> 2
      advanceToNextBlock(session); // 2 -> 3

      const advanced = advanceToNextBlock(session);

      expect(advanced).toBe(false);
      expect(session.status).toBe('failed');
    });

    it('should generate new challenge on advance', () => {
      const session = createSession('127.0.0.1', 9000);
      const originalChallengeId = session.challenge.id;

      advanceToNextBlock(session);

      expect(session.challenge.id).not.toBe(originalChallengeId);
    });
  });

  describe('markSessionPassed', () => {
    it('should set status to passed', () => {
      const session = createSession('127.0.0.1', 9000);
      markSessionPassed(session);

      expect(session.status).toBe('passed');
      expect(session.passedAt).toBeDefined();
    });
  });

  describe('markSessionFailed', () => {
    it('should set status to failed', () => {
      const session = createSession('127.0.0.1', 9000);
      markSessionFailed(session);

      expect(session.status).toBe('failed');
      expect(session.failedAt).toBeDefined();
    });
  });

  describe('deleteSession', () => {
    it('should remove session', () => {
      const session = createSession('127.0.0.1', 9000);
      expect(getSession(session.id)).not.toBeNull();

      deleteSession(session.id);

      expect(getSession(session.id)).toBeNull();
    });
  });

  describe('getSessionStats', () => {
    it('should return stats object', () => {
      const stats = getSessionStats();

      expect(stats).toHaveProperty('active');
      expect(stats).toHaveProperty('total');
      expect(typeof stats.active).toBe('number');
      expect(typeof stats.total).toBe('number');
    });
  });
});
