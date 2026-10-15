import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma';
import { WarmthTier } from '@prisma/client';

interface ScoreableContact {
  lastContactedAt: Date | null;
  replyRate?: number;
  avgThreadDepth?: number;
  replyRate30d?: number;
  replyRate90d?: number;
  replyRate180d?: number;
  avgResponseHours30d?: number | null;
  avgResponseHours90d?: number | null;
  avgResponseHours180d?: number | null;
  messagesLast30d?: number;
  messagesLast90d?: number;
  messagesLast180d?: number;
  conversationDays30d?: number;
  conversationDays90d?: number;
  conversationDays180d?: number;
}

@Injectable()
export class WarmthService {
  private readonly logger = new Logger(WarmthService.name);

  constructor(private readonly prisma: PrismaService) {}

  private clamp(value: number, min = 0, max = 100): number {
    return Math.max(min, Math.min(max, value));
  }

  private computeRecencyScore(lastContactedAt: Date | null): number {
    if (!lastContactedAt) return 0;
    const daysAgo = Math.floor(
      (Date.now() - lastContactedAt.getTime()) / (1000 * 60 * 60 * 24),
    );
    if (daysAgo <= 3) return 100;
    if (daysAgo <= 7) return 90;
    if (daysAgo <= 14) return 75;
    if (daysAgo <= 30) return 55;
    if (daysAgo <= 90) return 25;
    if (daysAgo <= 180) return 10;
    return 0;
  }

  private computeReplyRateScore(replyRate: number): number {
    if (replyRate >= 0.8) return 100;
    if (replyRate >= 0.6) return 85;
    if (replyRate >= 0.4) return 65;
    if (replyRate >= 0.2) return 40;
    if (replyRate > 0) return 20;
    return 0;
  }

  private computeThreadDepthScore(avgThreadDepth: number): number {
    if (avgThreadDepth > 6) return 100;
    if (avgThreadDepth >= 4) return 75;
    if (avgThreadDepth >= 2) return 45;
    if (avgThreadDepth > 0) return 20;
    return 0;
  }

  private computeResponseSpeedScore(
    avgResponseHours: number | null | undefined,
  ): number {
    if (avgResponseHours == null) return 60;
    if (avgResponseHours <= 6) return 100;
    if (avgResponseHours <= 24) return 85;
    if (avgResponseHours <= 72) return 65;
    if (avgResponseHours <= 168) return 35;
    return 10;
  }

  private computeResponseTrendScore(
    avgResponseHours30d: number | null | undefined,
    avgResponseHours180d: number | null | undefined,
  ): number {
    const currentScore = this.computeResponseSpeedScore(avgResponseHours30d);

    if (avgResponseHours30d == null || avgResponseHours180d == null) {
      return currentScore;
    }

    const ratio = avgResponseHours30d / Math.max(avgResponseHours180d, 1);
    if (ratio <= 0.75) return this.clamp(currentScore + 15);
    if (ratio <= 1.0) return this.clamp(currentScore + 5);
    if (ratio <= 1.5) return currentScore;
    if (ratio <= 2.0) return this.clamp(currentScore - 15);
    return this.clamp(currentScore - 30);
  }

  private computeFrequencyScore(contact: ScoreableContact): number {
    const recentMessages = contact.messagesLast30d || 0;
    const longWindowMessages = contact.messagesLast180d || 0;
    const recentConversationDays = contact.conversationDays30d || 0;
    const longWindowConversationDays = contact.conversationDays180d || 0;

    if (recentMessages === 0 && longWindowMessages === 0) {
      const recencyFallback = this.computeRecencyScore(contact.lastContactedAt);
      const depthFallback = this.computeThreadDepthScore(
        contact.avgThreadDepth || 0,
      );
      return Math.round(recencyFallback * 0.8 + depthFallback * 0.2);
    }

    const monthlyBaseline = longWindowMessages / 6 || 0;
    const activityRatio =
      monthlyBaseline > 0 ? recentMessages / monthlyBaseline : recentMessages;
    const consistencyBaseline = longWindowConversationDays / 6 || 0;
    const consistencyRatio =
      consistencyBaseline > 0
        ? recentConversationDays / consistencyBaseline
        : recentConversationDays;

    const activityScore = this.clamp(activityRatio * 50);
    const consistencyScore = this.clamp(consistencyRatio * 50);

    return Math.round((activityScore + consistencyScore) / 2);
  }

  computeScore(contact: ScoreableContact): number {
    const recency = this.computeRecencyScore(contact.lastContactedAt);
    const replyRateLong = this.computeReplyRateScore(
      contact.replyRate180d ?? contact.replyRate ?? 0,
    );
    const replyRateRecent = this.computeReplyRateScore(
      contact.replyRate30d ?? contact.replyRate90d ?? contact.replyRate ?? 0,
    );
    const responseTrend = this.computeResponseTrendScore(
      contact.avgResponseHours30d,
      contact.avgResponseHours180d,
    );
    const frequency = this.computeFrequencyScore(contact);
    const threadDepth = this.computeThreadDepthScore(
      contact.avgThreadDepth || 0,
    );

    return (
      recency * 0.3 +
      replyRateLong * 0.2 +
      replyRateRecent * 0.15 +
      responseTrend * 0.15 +
      frequency * 0.15 +
      threadDepth * 0.05
    );
  }

  scoreToTier(score: number): WarmthTier {
    if (score >= 80) return WarmthTier.hot;
    if (score >= 50) return WarmthTier.warm;
    if (score >= 20) return WarmthTier.cold;
    return WarmthTier.frozen;
  }

  async computeWarmthScores(userId: string): Promise<void> {
    const contacts = await this.prisma.contact.findMany({
      where: { userId, isArchived: false, inclusionStatus: 'active' },
    });

    const now = new Date();
    const recordedOn = new Date(now);
    recordedOn.setUTCHours(0, 0, 0, 0);

    for (const contact of contacts) {
      const newScore = this.computeScore(contact);
      const computedTier = this.scoreToTier(newScore);
      const finalTier = contact.warmthTierOverride || computedTier;
      const previousSnapshot =
        await this.prisma.contactWarmthSnapshot.findFirst({
          where: {
            contactId: contact.id,
            recordedOn: { lt: recordedOn },
          },
          orderBy: { recordedOn: 'desc' },
        });

      const updateData: Record<string, unknown> = {
        warmthScore: Math.round(newScore * 100) / 100,
        warmthTier: finalTier,
        warmthUpdatedAt: now,
        warmthScorePrevious:
          previousSnapshot?.score ??
          contact.warmthScorePrevious ??
          contact.warmthScore,
      };

      await this.prisma.contact.update({
        where: { id: contact.id },
        data: updateData,
      });

      await this.prisma.contactWarmthSnapshot.upsert({
        where: {
          uq_contact_warmth_snapshot: {
            contactId: contact.id,
            recordedOn,
          },
        },
        create: {
          userId,
          contactId: contact.id,
          recordedOn,
          score: Math.round(newScore * 100) / 100,
          tier: finalTier,
        },
        update: {
          score: Math.round(newScore * 100) / 100,
          tier: finalTier,
        },
      });
    }

    this.logger.log(`Scored ${contacts.length} contacts for user ${userId}`);
  }
}
