import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma';

const PIPELINE_STAGES = ['intro', 'meeting', 'dd', 'term_sheet', 'closed_won'];

// Industry benchmark conversion rates — used when pipeline data < 10 contacts
const DEFAULT_RATES: Record<string, number> = {
  intro: 0.3,
  meeting: 0.45,
  dd: 0.65,
  term_sheet: 0.9,
};

// Weight of each stage in the close-probability chain
const STAGE_WEIGHTS: Record<string, number> = {
  intro: 0.3 * 0.45 * 0.65 * 0.9,
  meeting: 0.45 * 0.65 * 0.9,
  dd: 0.65 * 0.9,
  term_sheet: 0.9,
  closed_won: 1.0,
};

const DEFAULT_CHECK_SIZE = 250_000; // $250k fallback if no check size recorded

@Injectable()
export class ForecastingService {
  private readonly logger = new Logger(ForecastingService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getCurrentForecast(userId: string) {
    // Return latest snapshot if calculated today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existing = await this.prisma.forecastSnapshot.findFirst({
      where: {
        userId,
        snapshotDate: { gte: today },
      },
      orderBy: { snapshotDate: 'desc' },
    });

    if (existing) return existing;

    return this.calculateAndSaveForecast(userId);
  }

  async calculateAndSaveForecast(userId: string) {
    this.logger.log(`Calculating forecast for user ${userId}`);

    const [stageConversionRates, avgDaysPerStage] =
      await this.calculateStageMetrics(userId);

    const { pipelineValueUsd, committedUsd } = await this.weightPipeline(
      userId,
      stageConversionRates,
    );

    const profile = await this.prisma.startupProfile.findUnique({
      where: { userId },
    });
    const targetRaiseUsd = profile?.raiseTargetUsd ?? null;

    const { projectedCloseDate, meetingsNeededPerWeek, closeProbability } =
      this.projectClose(
        pipelineValueUsd,
        committedUsd,
        targetRaiseUsd,
        stageConversionRates,
        avgDaysPerStage,
      );

    const currentVelocity = await this.getMeetingsPerWeek(userId, 4);
    const onTrack = currentVelocity >= meetingsNeededPerWeek * 0.8;

    const snapshot = await this.prisma.forecastSnapshot.create({
      data: {
        userId,
        targetRaiseUsd,
        committedUsd,
        pipelineValueUsd,
        closeProbability,
        projectedCloseDate,
        meetingsNeededPerWeek,
        currentVelocity,
        onTrack,
        stageConversionRates,
        avgDaysPerStage,
      },
    });

    return snapshot;
  }

  private async calculateStageMetrics(userId: string) {
    const events = await this.prisma.pipelineEvent.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });

    const conversionRates: Record<string, number> = {};
    const avgDays: Record<string, number> = {};

    for (const stage of PIPELINE_STAGES.slice(0, -1)) {
      const entered = events.filter((e) => e.toStage === stage).length;
      const advanced = events.filter((e) => e.fromStage === stage).length;

      if (entered >= 5) {
        conversionRates[stage] = advanced / entered;
      } else {
        conversionRates[stage] = DEFAULT_RATES[stage] ?? 0.5;
      }
    }

    // Calculate average days per stage from pipeline event pairs
    const contacts = await this.prisma.contact.findMany({
      where: {
        userId,
        pipelineStage: { not: 'none' },
        inclusionStatus: 'active',
      },
      select: { id: true },
    });

    for (const stage of PIPELINE_STAGES.slice(0, -1)) {
      const stageDurations: number[] = [];

      for (const contact of contacts) {
        const contactEvents = events.filter((e) => e.contactId === contact.id);
        const entryEvent = contactEvents.find((e) => e.toStage === stage);
        const exitEvent = contactEvents.find(
          (e) =>
            e.fromStage === stage &&
            e.createdAt > (entryEvent?.createdAt ?? new Date(0)),
        );

        if (entryEvent && exitEvent) {
          const days =
            (exitEvent.createdAt.getTime() - entryEvent.createdAt.getTime()) /
            (1000 * 60 * 60 * 24);
          stageDurations.push(days);
        }
      }

      avgDays[stage] =
        stageDurations.length > 0
          ? stageDurations.reduce((a, b) => a + b, 0) / stageDurations.length
          : 14; // 2-week default
    }

    return [conversionRates, avgDays] as const;
  }

  private async weightPipeline(
    userId: string,
    conversionRates: Record<string, number>,
  ) {
    const pipeline = await this.prisma.contact.findMany({
      where: {
        userId,
        pipelineStage: { not: 'none' },
        isArchived: false,
        inclusionStatus: 'active',
      },
      select: { pipelineStage: true },
    });

    let pipelineValueUsd = 0;
    let committedUsd = 0;

    for (const entry of pipeline) {
      const stage = entry.pipelineStage;
      const checkSize = DEFAULT_CHECK_SIZE;

      if (stage === 'closed_won') {
        committedUsd += checkSize;
      } else {
        const prob = STAGE_WEIGHTS[stage] ?? 0.1;
        pipelineValueUsd += checkSize * prob;
      }
    }

    return { pipelineValueUsd: Math.round(pipelineValueUsd), committedUsd };
  }

  private projectClose(
    pipelineValueUsd: number,
    committedUsd: number,
    targetRaiseUsd: number | null,
    conversionRates: Record<string, number>,
    avgDays: Record<string, number>,
  ) {
    const target = targetRaiseUsd ?? 1_000_000;
    const remaining = Math.max(target - committedUsd, 0);

    if (remaining === 0) {
      return {
        closeProbability: 1.0,
        projectedCloseDate: new Date(),
        meetingsNeededPerWeek: 0,
      };
    }

    const closeProbability = Math.min(
      (committedUsd + pipelineValueUsd) / target,
      1.0,
    );

    // Estimate weeks needed based on average pipeline velocity
    const avgCycleWeeks = Object.values(avgDays).reduce((a, b) => a + b, 0) / 7;

    const safeCloseProb = Math.max(closeProbability, 0.01);
    const projectedWeeks = Math.max(avgCycleWeeks * (1 / safeCloseProb), 4);
    const projectedCloseDate = new Date();
    projectedCloseDate.setDate(
      projectedCloseDate.getDate() + Math.round(projectedWeeks * 7),
    );

    // Meetings needed: rough heuristic — need enough meetings to fill remaining gap
    const meetingsNeededPerWeek =
      remaining > 0
        ? Math.max(
            Math.ceil(
              remaining /
                DEFAULT_CHECK_SIZE /
                (conversionRates['meeting'] ?? 0.45) /
                Math.max(projectedWeeks, 1),
            ),
            0.5,
          )
        : 0;

    return {
      closeProbability: parseFloat(closeProbability.toFixed(2)),
      projectedCloseDate,
      meetingsNeededPerWeek: parseFloat(meetingsNeededPerWeek.toFixed(1)),
    };
  }

  private async getMeetingsPerWeek(
    userId: string,
    weeks: number,
  ): Promise<number> {
    const since = new Date();
    since.setDate(since.getDate() - weeks * 7);

    const count = await this.prisma.pipelineEvent.count({
      where: {
        userId,
        toStage: 'meeting',
        createdAt: { gte: since },
      },
    });

    return parseFloat((count / weeks).toFixed(1));
  }
}
