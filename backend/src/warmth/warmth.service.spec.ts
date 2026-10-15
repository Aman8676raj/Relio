import { WarmthService } from './warmth.service';
import { WarmthTier } from '@prisma/client';
import { PrismaService } from '../prisma';

describe('WarmthService', () => {
  let service: WarmthService;

  beforeEach(() => {
    // Create service with a mock PrismaService
    service = new WarmthService({} as PrismaService);
  });

  describe('computeScore', () => {
    it('should return hot score for active contact', () => {
      const score = service.computeScore({
        lastContactedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
        replyRate: 0.8,
        avgThreadDepth: 6.0,
      });
      expect(score).toBeGreaterThanOrEqual(80);
    });

    it('should return frozen score for inactive contact', () => {
      const score = service.computeScore({
        lastContactedAt: new Date(Date.now() - 200 * 24 * 60 * 60 * 1000), // 200 days ago
        replyRate: 0.05,
        avgThreadDepth: 1.0,
      });
      expect(score).toBeLessThan(20);
    });

    it('should return warm score for moderate contact', () => {
      const score = service.computeScore({
        lastContactedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000), // 20 days ago
        replyRate: 0.35,
        avgThreadDepth: 4.0,
      });
      expect(score).toBeGreaterThanOrEqual(50);
      expect(score).toBeLessThan(80);
    });

    it('should return cold score for declining contact', () => {
      const score = service.computeScore({
        lastContactedAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), // 60 days ago
        replyRate: 0.1,
        avgThreadDepth: 2.0,
      });
      expect(score).toBeGreaterThanOrEqual(20);
      expect(score).toBeLessThan(50);
    });

    it('should return 0 for null lastContactedAt', () => {
      const score = service.computeScore({
        lastContactedAt: null,
        replyRate: 0,
        avgThreadDepth: 0,
      });
      expect(score).toBeLessThan(20);
    });
  });

  describe('scoreToTier', () => {
    it('should map scores to correct tiers', () => {
      expect(service.scoreToTier(90)).toBe(WarmthTier.hot);
      expect(service.scoreToTier(80)).toBe(WarmthTier.hot);
      expect(service.scoreToTier(65)).toBe(WarmthTier.warm);
      expect(service.scoreToTier(50)).toBe(WarmthTier.warm);
      expect(service.scoreToTier(35)).toBe(WarmthTier.cold);
      expect(service.scoreToTier(20)).toBe(WarmthTier.cold);
      expect(service.scoreToTier(10)).toBe(WarmthTier.frozen);
      expect(service.scoreToTier(0)).toBe(WarmthTier.frozen);
    });
  });
});
