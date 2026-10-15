import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Subject } from 'rxjs';
import { PrismaService } from '../prisma';
import { ContextAssemblyService } from './context-assembly.service';
import { MarketIntelligenceService } from './market-intelligence.service';
import { SynthesisService } from './synthesis.service';
import type { CreateAnalysisDto } from './dto/create-analysis.dto';
import type { CreateFounderProfileDto } from './dto/create-founder-profile.dto';

/** Shape of an SSE event emitted during pipeline execution */
export interface PipelineEvent {
  type:
    | 'connected'
    | 'stage_start'
    | 'stage_done'
    | 'stage_timeout'
    | 'stage_error'
    | 'complete'
    | 'failed';
  stage?: number;
  label?: string;
  elapsed?: number;
  detail?: string;
  result?: Record<string, unknown>;
}

@Injectable()
export class FeatureAnalysisService {
  private readonly logger = new Logger(FeatureAnalysisService.name);
  private readonly model: string;

  /** Active SSE subjects keyed by analysisId */
  private readonly streams = new Map<string, Subject<PipelineEvent>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly contextAssembly: ContextAssemblyService,
    private readonly marketIntelligence: MarketIntelligenceService,
    private readonly synthesis: SynthesisService,
    private readonly config: ConfigService,
  ) {
    this.model = this.config.get<string>('ANTHROPIC_MODEL') ?? 'claude-sonnet-4-20250514';
  }

  // ─── Founder Profile ────────────────────────────────────────────────────────

  async upsertFounderProfile(userId: string, dto: CreateFounderProfileDto) {
    return this.prisma.founderProfile.upsert({
      where: { userId },
      create: { userId, ...dto },
      update: { ...dto },
    });
  }

  async getFounderProfile(userId: string) {
    const profile = await this.prisma.founderProfile.findUnique({
      where: { userId },
    });
    if (!profile) {
      throw new NotFoundException(
        'No founder profile found. Create one first via POST /api/feature-analysis/profile.',
      );
    }
    return profile;
  }

  // ─── Pipeline: Create pending record ────────────────────────────────────────

  async createPendingAnalysis(userId: string, dto: CreateAnalysisDto) {
    // Need founder profile to create the record
    const profile = await this.prisma.founderProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException(
        'No founder profile found. Create one first via POST /api/feature-analysis/profile.',
      );
    }

    const record = await this.prisma.featureAnalysis.create({
      data: {
        userId,
        founderId: profile.id,
        featureName: dto.featureName,
        featureDescription: dto.featureDescription,
        featureCategory: dto.featureCategory,
        estimatedBuildDays: dto.estimatedBuildDays ?? null,
        status: 'pending',
        modelVersion: this.model,
      },
    });

    this.logger.log(`Created pending analysis ${record.id} for "${dto.featureName}"`);
    return record;
  }

  // ─── Pipeline: SSE stream management ────────────────────────────────────────

  getStream(analysisId: string): Subject<PipelineEvent> | undefined {
    return this.streams.get(analysisId);
  }

  // ─── Pipeline: Run (fire-and-forget, emits events via Subject) ─────────────

  async runPipeline(analysisId: string, userId: string, dto: CreateAnalysisDto) {
    const subject = new Subject<PipelineEvent>();
    this.streams.set(analysisId, subject);
    const t0 = Date.now();

    const emit = (event: PipelineEvent) => {
      this.logger.debug(`[${analysisId}] SSE: ${event.type} stage=${event.stage ?? '-'}`);
      subject.next(event);
    };

    try {
      // Mark as running
      await this.prisma.featureAnalysis.update({
        where: { id: analysisId },
        data: { status: 'running' },
      });

      // ── Stage 1: Context Assembly ──────────────────────────────────────────
      emit({ type: 'stage_start', stage: 1, label: 'Context Assembly' });
      const context = await this.contextAssembly.assemble(userId);
      const s1Elapsed = Date.now() - t0;
      emit({
        type: 'stage_done',
        stage: 1,
        label: 'Context Assembly',
        elapsed: s1Elapsed,
        detail: `${context.investorPipeline.length} investors, ${context.priorFeatureDecisions.length} prior decisions`,
      });
      this.logger.log(`[Stage 1/3] Complete in ${s1Elapsed}ms`);

      // ── Stage 2: Market Intelligence ───────────────────────────────────────
      const t2 = Date.now();
      emit({ type: 'stage_start', stage: 2, label: 'Market Intelligence' });
      const research = await this.marketIntelligence.research(
        dto.featureDescription,
        dto.featureCategory,
      );
      const s2Elapsed = Date.now() - t2;

      if (research.timedOut) {
        emit({
          type: 'stage_timeout',
          stage: 2,
          label: 'Market Intelligence',
          elapsed: s2Elapsed,
          detail: 'Web search timed out after 45s — continuing with limited market context',
        });
        this.logger.warn(`[Stage 2/3] Timed out after ${s2Elapsed}ms`);
      } else {
        emit({
          type: 'stage_done',
          stage: 2,
          label: 'Market Intelligence',
          elapsed: s2Elapsed,
          detail: `${research.raw.length} chars of research`,
        });
        this.logger.log(`[Stage 2/3] Complete in ${s2Elapsed}ms`);
      }

      // ── Stage 3: Synthesis ─────────────────────────────────────────────────
      const t3 = Date.now();
      emit({ type: 'stage_start', stage: 3, label: 'Synthesis' });
      const result = await this.synthesis.synthesize(context, research, dto);
      const s3Elapsed = Date.now() - t3;
      emit({
        type: 'stage_done',
        stage: 3,
        label: 'Synthesis',
        elapsed: s3Elapsed,
        detail: `verdict="${result.verdict}"`,
      });
      this.logger.log(`[Stage 3/3] Complete in ${s3Elapsed}ms — verdict="${result.verdict}"`);

      // ── Persist result ─────────────────────────────────────────────────────
      const updated = await this.prisma.featureAnalysis.update({
        where: { id: analysisId },
        data: {
          status: 'complete',
          verdict: result.verdict,
          verdictReasoning: result.verdictReasoning,
          revenueImpactLow: result.revenueImpact.low,
          revenueImpactHigh: result.revenueImpact.high,
          investorAlignmentScore: result.investorAlignmentScore,
          alignedInvestors: result.alignedInvestors as any,
          marketPrecedents: result.marketPrecedents as any,
          recommendations: result.recommendations as any,
          rawMarketResearch: research.raw,
        },
      });

      emit({
        type: 'complete',
        elapsed: Date.now() - t0,
        result: updated as unknown as Record<string, unknown>,
      });

      this.logger.log(
        `Pipeline complete for "${dto.featureName}" in ${Date.now() - t0}ms: verdict=${result.verdict}, id=${analysisId}`,
      );
    } catch (err: any) {
      this.logger.error(`Pipeline FAILED for ${analysisId}: ${err.message}`);
      emit({
        type: 'failed',
        elapsed: Date.now() - t0,
        detail: err.message || 'Unknown pipeline error',
      });

      await this.prisma.featureAnalysis.update({
        where: { id: analysisId },
        data: { status: 'failed', errorMessage: err.message },
      }).catch(() => {}); // don't throw from error handler
    } finally {
      subject.complete();
      this.streams.delete(analysisId);
    }
  }

  // ─── Queries ────────────────────────────────────────────────────────────────

  async listForUser(userId: string) {
    return this.prisma.featureAnalysis.findMany({
      where: { userId, status: 'complete' },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        featureName: true,
        featureCategory: true,
        verdict: true,
        investorAlignmentScore: true,
        revenueImpactLow: true,
        revenueImpactHigh: true,
        estimatedBuildDays: true,
        createdAt: true,
      },
    });
  }

  async getById(id: string, userId: string) {
    const record = await this.prisma.featureAnalysis.findFirst({
      where: { id, userId },
    });
    if (!record) {
      throw new NotFoundException('Feature analysis not found.');
    }
    return record;
  }

  /**
   * Fetch by ID without user filter — used in SSE fallback when the stream
   * is already gone. Safe because the POST that created the record was
   * authenticated.
   */
  async getByIdDirect(id: string) {
    return this.prisma.featureAnalysis.findUnique({ where: { id } });
  }
}
