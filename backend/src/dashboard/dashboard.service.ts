import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma';
import { PipelineStage } from '@prisma/client';

export interface ContactSummary {
  id: string;
  name: string | null;
  email: string;
  company: string | null;
  warmthTier: string;
  warmthScore: number | null;
  lastContactedAt: Date | null;
  pipelineStage: string;
  lastInboundAt: Date | null;
  lastOutboundAt: Date | null;
}

export interface PriorityAction {
  type: 'follow_up' | 'at_risk' | 'stalled_pipeline';
  contact: ContactSummary;
  reason: string;
  ctaLabel: string;
  ctaType: 'draft' | 'view_thread';
  priority: number;
}

export interface TierBucket {
  count: number;
  atRisk: number;
  overdueTouch: number;
}

export interface ReportMetric {
  name: string;
  grade: string;
  note: string;
}

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Raise Momentum Score ─────────────────────────────────────────────────

  async getPulse(userId: string) {
    const contacts = await this.prisma.contact.findMany({
      where: { userId, isArchived: false, inclusionStatus: 'active' },
    });

    const pipelineContacts = contacts.filter(
      (c) => c.pipelineStage !== PipelineStage.none,
    );

    // Active conversations: pipeline contacts with thread activity in last 14 days
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const activeConversations = pipelineContacts.filter(
      (c) => c.lastContactedAt && c.lastContactedAt >= fourteenDaysAgo,
    ).length;

    // Soft ghosting: outbound sent 5+ days ago with no reply
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    const softGhosts = contacts.filter((c) => {
      if (!c.lastOutboundAt) return false;
      if (c.lastOutboundAt < fiveDaysAgo) {
        // No inbound at all, or last inbound is before last outbound
        return !c.lastInboundAt || c.lastInboundAt < c.lastOutboundAt;
      }
      return false;
    });

    // Momentum score: composite of response latency trends + reply rate deltas
    let momentum = 50; // baseline
    if (pipelineContacts.length > 0) {
      const latencyScores: number[] = [];
      const replyTrends: number[] = [];

      for (const c of pipelineContacts) {
        // Response speed trending better → positive signal
        if (c.avgResponseHours30d != null && c.avgResponseHours90d != null) {
          const ratio =
            c.avgResponseHours30d / Math.max(c.avgResponseHours90d, 1);
          // ratio < 1 means getting faster = good
          latencyScores.push(
            ratio <= 0.75 ? 20 : ratio <= 1.0 ? 10 : ratio <= 1.5 ? 0 : -15,
          );
        }

        // Reply rate improving → positive
        const replyDelta = (c.replyRate30d || 0) - (c.replyRate180d || 0);
        replyTrends.push(replyDelta * 50); // scale to meaningful range
      }

      const avgLatency =
        latencyScores.length > 0
          ? latencyScores.reduce((a, b) => a + b, 0) / latencyScores.length
          : 0;
      const avgReplyTrend =
        replyTrends.length > 0
          ? replyTrends.reduce((a, b) => a + b, 0) / replyTrends.length
          : 0;

      // Ghost penalty
      const ghostPenalty = softGhosts.length * 5;

      // Active conversation bonus
      const activeBonus = Math.min(activeConversations * 5, 20);

      momentum = Math.round(
        Math.max(
          0,
          Math.min(
            100,
            50 + avgLatency + avgReplyTrend - ghostPenalty + activeBonus,
          ),
        ),
      );
    }

    // Confidence based on pipeline size
    const confidence =
      pipelineContacts.length >= 10
        ? 'high'
        : pipelineContacts.length >= 5
          ? 'medium'
          : 'low';

    // 7-day delta: compare warmth snapshots
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentSnapshots = await this.prisma.contactWarmthSnapshot.findMany({
      where: {
        userId,
        recordedOn: { gte: sevenDaysAgo },
      },
      orderBy: { recordedOn: 'asc' },
    });

    // Average score now vs 7 days ago
    const nowAvg =
      contacts.length > 0
        ? contacts.reduce((sum, c) => sum + (c.warmthScore || 0), 0) /
          contacts.length
        : 0;

    const oldScores = recentSnapshots.filter(
      (s) =>
        s.recordedOn.getTime() <= sevenDaysAgo.getTime() + 24 * 60 * 60 * 1000,
    );
    const oldAvg =
      oldScores.length > 0
        ? oldScores.reduce((sum, s) => sum + s.score, 0) / oldScores.length
        : nowAvg;

    const delta = Math.round(momentum - (oldAvg > 0 ? oldAvg : momentum));

    // Tier breakdown
    const tierBreakdown = this.computeTierBreakdown(contacts);

    // Morning delta summary
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const newReplies = contacts.filter(
      (c) => c.lastInboundAt && c.lastInboundAt >= oneDayAgo,
    ).length;

    const newGhosts = softGhosts.filter(
      (c) => c.lastOutboundAt && c.lastOutboundAt >= oneDayAgo,
    ).length;

    return {
      momentum: {
        score: momentum,
        delta,
        confidence,
        activeConversations,
        basedOn: `${pipelineContacts.length} pipeline conversations`,
      },
      softGhosts: {
        count: softGhosts.length,
        contacts: softGhosts.slice(0, 5).map((c) => this.toSummary(c)),
      },
      tierBreakdown,
      weeklyDelta: {
        newReplies,
        newGhosts,
        momentumChange: delta,
      },
    };
  }

  // ── Priority Actions ──────────────────────────────────────────────────────

  async getActions(userId: string): Promise<PriorityAction[]> {
    const contacts = await this.prisma.contact.findMany({
      where: { userId, isArchived: false, inclusionStatus: 'active' },
    });

    const actions: PriorityAction[] = [];
    const now = Date.now();

    for (const c of contacts) {
      // Follow-up overdue: outbound sent > 5 days ago, no reply
      if (c.lastOutboundAt) {
        const daysSinceOutbound = Math.floor(
          (now - c.lastOutboundAt.getTime()) / (1000 * 60 * 60 * 24),
        );
        const noReply = !c.lastInboundAt || c.lastInboundAt < c.lastOutboundAt;

        if (daysSinceOutbound >= 5 && noReply) {
          const warmthLabel =
            c.warmthTier === 'hot'
              ? 'was hot'
              : c.warmthTier === 'warm'
                ? 'was warm'
                : '';
          actions.push({
            type: 'follow_up',
            contact: this.toSummary(c),
            reason: `${daysSinceOutbound} days since last reply${warmthLabel ? `, ${warmthLabel}` : ''}`,
            ctaLabel: 'Draft Follow-up',
            ctaType: 'draft',
            priority:
              (c.warmthTier === 'hot'
                ? 30
                : c.warmthTier === 'warm'
                  ? 20
                  : 10) + daysSinceOutbound,
          });
        }
      }

      // At risk: warmth score dropped significantly
      if (
        c.warmthScorePrevious != null &&
        c.warmthScore != null &&
        c.warmthScorePrevious - c.warmthScore >= 10
      ) {
        actions.push({
          type: 'at_risk',
          contact: this.toSummary(c),
          reason: `Warmth dropped ${Math.round(c.warmthScorePrevious - c.warmthScore)} points — relationship cooling`,
          ctaLabel: 'Draft Follow-up',
          ctaType: 'draft',
          priority: 25 + (c.warmthScorePrevious - c.warmthScore),
        });
      }

      // Stalled pipeline: in same stage 14+ days
      if (c.pipelineStage !== PipelineStage.none && c.pipelineUpdatedAt) {
        const daysSinceUpdate = Math.floor(
          (now - c.pipelineUpdatedAt.getTime()) / (1000 * 60 * 60 * 24),
        );
        if (daysSinceUpdate >= 14) {
          actions.push({
            type: 'stalled_pipeline',
            contact: this.toSummary(c),
            reason: `Stalled in ${c.pipelineStage} stage for ${daysSinceUpdate} days`,
            ctaLabel: 'View Thread',
            ctaType: 'view_thread',
            priority: 15 + daysSinceUpdate,
          });
        }
      }
    }

    // Sort by priority descending, take top 5
    actions.sort((a, b) => b.priority - a.priority);
    return actions.slice(0, 5);
  }

  // ── Weekly Report Card ─────────────────────────────────────────────────────

  async getReportCard(userId: string) {
    const contacts = await this.prisma.contact.findMany({
      where: { userId, isArchived: false, inclusionStatus: 'active' },
    });

    const pipelineContacts = contacts.filter(
      (c) => c.pipelineStage !== PipelineStage.none,
    );

    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    const fourteenDaysAgo = now - 14 * 24 * 60 * 60 * 1000;

    // Outreach volume: new outbound in last 7 days vs previous 7 days
    const thisWeekOutbound = contacts.filter(
      (c) => c.lastOutboundAt && c.lastOutboundAt.getTime() >= sevenDaysAgo,
    ).length;
    const lastWeekOutbound = contacts.filter(
      (c) =>
        c.lastOutboundAt &&
        c.lastOutboundAt.getTime() >= fourteenDaysAgo &&
        c.lastOutboundAt.getTime() < sevenDaysAgo,
    ).length;

    // Response rate: overall + warm intros
    const replyRates = contacts
      .filter((c) => c.outboundCount > 0)
      .map((c) => c.replyRate30d || c.replyRate || 0);
    const overallReplyRate =
      replyRates.length > 0
        ? replyRates.reduce((a, b) => a + b, 0) / replyRates.length
        : 0;

    const warmIntroReplyRate = contacts
      .filter(
        (c) =>
          (c.warmthTier === 'hot' || c.warmthTier === 'warm') &&
          c.outboundCount > 0,
      )
      .map((c) => c.replyRate30d || c.replyRate || 0);
    const warmAvg =
      warmIntroReplyRate.length > 0
        ? warmIntroReplyRate.reduce((a, b) => a + b, 0) /
          warmIntroReplyRate.length
        : 0;

    // Pipeline velocity: stalled conversations
    const stalledCount = pipelineContacts.filter((c) => {
      if (!c.pipelineUpdatedAt) return false;
      return now - c.pipelineUpdatedAt.getTime() >= 14 * 24 * 60 * 60 * 1000;
    }).length;

    // Relationship health: Tier 1 contacts touched within 30 days
    const tier1 = contacts.filter(
      (c) => c.warmthTier === 'hot' || c.warmthTier === 'warm',
    );
    const tier1Touched = tier1.filter(
      (c) =>
        c.lastContactedAt &&
        now - c.lastContactedAt.getTime() <= 30 * 24 * 60 * 60 * 1000,
    ).length;
    const tier1Health = tier1.length > 0 ? tier1Touched / tier1.length : 1;

    const metrics: ReportMetric[] = [
      {
        name: 'Outreach Volume',
        grade: this.letterGrade(thisWeekOutbound, [2, 5, 8, 12, 16]),
        note: `${thisWeekOutbound} conversations this week${lastWeekOutbound > 0 ? ` (${thisWeekOutbound > lastWeekOutbound ? 'up' : 'down'} from ${lastWeekOutbound})` : ''}`,
      },
      {
        name: 'Response Rate',
        grade: this.letterGrade(overallReplyRate * 100, [10, 25, 40, 55, 70]),
        note: `${Math.round(overallReplyRate * 100)}% overall${warmAvg > 0 ? ` — warm intros at ${Math.round(warmAvg * 100)}%` : ''}`,
      },
      {
        name: 'Pipeline Velocity',
        grade: this.letterGradeInverse(stalledCount, [0, 1, 3, 5, 8]),
        note:
          stalledCount > 0
            ? `${stalledCount} conversation${stalledCount > 1 ? 's' : ''} stalled 14+ days`
            : 'No stalled conversations — pipeline is moving',
      },
      {
        name: 'Relationship Health',
        grade: this.letterGrade(tier1Health * 100, [30, 50, 70, 85, 95]),
        note:
          tier1.length > 0
            ? `${tier1Touched}/${tier1.length} Tier 1 contacts touched within cadence`
            : 'No Tier 1 contacts yet',
      },
    ];

    return {
      metrics,
      generatedAt: new Date().toISOString(),
    };
  }

  // ── Activity Heatmap ───────────────────────────────────────────────────────

  async getHeatmap(userId: string): Promise<number[][]> {
    const grid: number[][] = Array.from({ length: 12 }, () => Array(7).fill(0));

    const now = new Date();
    const day = now.getDay();
    const diffToMonday = now.getDate() - day + (day === 0 ? -6 : 1);
    const startOfCurrentWeek = new Date(now.setDate(diffToMonday));
    startOfCurrentWeek.setHours(0, 0, 0, 0);

    const WEEKS_TO_TRACK = 12;
    const trackingStartDate = new Date(
      startOfCurrentWeek.getTime() -
        (WEEKS_TO_TRACK - 1) * 7 * 24 * 60 * 60 * 1000,
    );

    const messages = await this.prisma.emailMessage.findMany({
      where: { userId, sentAt: { gte: trackingStartDate } },
      select: { sentAt: true },
    });

    const pipelineEvents = await this.prisma.pipelineEvent.findMany({
      where: { userId, createdAt: { gte: trackingStartDate } },
      select: { createdAt: true },
    });

    const events = [
      ...(messages.map((m) => m.sentAt?.getTime()).filter(Boolean) as number[]),
      ...pipelineEvents.map((p) => p.createdAt.getTime()),
    ];

    events.forEach((time) => {
      if (time >= trackingStartDate.getTime()) {
        const daysSinceStart = Math.floor(
          (time - trackingStartDate.getTime()) / (1000 * 60 * 60 * 24),
        );
        const weekIndex = Math.floor(daysSinceStart / 7);
        const dayIndex = daysSinceStart % 7;

        if (weekIndex >= 0 && weekIndex < 12 && dayIndex >= 0 && dayIndex < 7) {
          grid[weekIndex][dayIndex]++;
        }
      }
    });

    return grid;
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private computeTierBreakdown(
    contacts: {
      warmthTier: string;
      warmthScore: number | null;
      warmthScorePrevious: number | null;
      lastContactedAt: Date | null;
    }[],
  ) {
    const now = Date.now();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

    const hot: TierBucket = { count: 0, atRisk: 0, overdueTouch: 0 };
    const warm: TierBucket = { count: 0, atRisk: 0, overdueTouch: 0 };
    const cold: TierBucket = { count: 0, atRisk: 0, overdueTouch: 0 };
    const frozen: TierBucket = { count: 0, atRisk: 0, overdueTouch: 0 };

    for (const c of contacts) {
      const bucket =
        c.warmthTier === 'hot'
          ? hot
          : c.warmthTier === 'warm'
            ? warm
            : c.warmthTier === 'cold'
              ? cold
              : frozen;

      bucket.count++;

      // At risk: score dropped 10+ points
      if (
        c.warmthScorePrevious != null &&
        c.warmthScore != null &&
        c.warmthScorePrevious - c.warmthScore >= 10
      ) {
        bucket.atRisk++;
      }

      // Overdue touch: not contacted in 30+ days
      if (
        !c.lastContactedAt ||
        now - c.lastContactedAt.getTime() > thirtyDaysMs
      ) {
        bucket.overdueTouch++;
      }
    }

    return { hot, warm, cold, frozen };
  }

  private toSummary(c: {
    id: string;
    name: string | null;
    email: string;
    company: string | null;
    warmthTier: string;
    warmthScore: number | null;
    lastContactedAt: Date | null;
    pipelineStage: string;
    lastInboundAt: Date | null;
    lastOutboundAt: Date | null;
  }): ContactSummary {
    return {
      id: c.id,
      name: c.name,
      email: c.email,
      company: c.company,
      warmthTier: c.warmthTier,
      warmthScore: c.warmthScore,
      lastContactedAt: c.lastContactedAt,
      pipelineStage: c.pipelineStage,
      lastInboundAt: c.lastInboundAt,
      lastOutboundAt: c.lastOutboundAt,
    };
  }

  private letterGrade(
    value: number,
    thresholds: [number, number, number, number, number],
  ): string {
    if (value >= thresholds[4]) return 'A+';
    if (value >= thresholds[3]) return 'A-';
    if (value >= thresholds[2]) return 'B+';
    if (value >= thresholds[1]) return 'C+';
    if (value >= thresholds[0]) return 'C';
    return 'D';
  }

  private letterGradeInverse(
    value: number,
    thresholds: [number, number, number, number, number],
  ): string {
    if (value <= thresholds[0]) return 'A+';
    if (value <= thresholds[1]) return 'A-';
    if (value <= thresholds[2]) return 'B+';
    if (value <= thresholds[3]) return 'C+';
    if (value <= thresholds[4]) return 'C';
    return 'D';
  }
}
