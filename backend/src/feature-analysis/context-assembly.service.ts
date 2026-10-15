import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma';
import { InvestorAlignmentService, EnrichedInvestor } from './investor-alignment.service';

export interface FounderAnalysisContext {
  founderProfile: {
    id: string;
    appName: string;
    appDescription: string;
    targetMarket: string;
    currentMRR: number;
    stage: string;
    fundingGoal: number;
  };
  investorPipeline: EnrichedInvestor[];
  priorFeatureDecisions: {
    feature: string;
    verdict: string;
    outcome?: string;
  }[];
}

@Injectable()
export class ContextAssemblyService {
  private readonly logger = new Logger(ContextAssemblyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly investorAlignment: InvestorAlignmentService,
  ) {}

  async assemble(userId: string): Promise<FounderAnalysisContext> {
    // Stage 1: fetch founder profile
    const profile = await this.prisma.founderProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException(
        'Founder profile not found. Create one first via POST /api/feature-analysis/profile.',
      );
    }

    // Fetch investor-type contacts ordered by warmth
    const investorContacts = await this.prisma.contact.findMany({
      where: {
        userId,
        contactType: 'investor',
        isArchived: false,
        pipelineStage: { notIn: ['none'] },
      },
      orderBy: { warmthScore: 'desc' },
      take: 20, // cap context window
    });

    // Enrich each investor with thesis via one-time Claude web search (cached on Contact row)
    const enriched = await Promise.all(
      investorContacts.map((c) => this.investorAlignment.enrichFromWeb(c)),
    );

    // Fetch prior feature decisions for learning signal
    const prior = await this.prisma.featureAnalysis.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        featureName: true,
        verdict: true,
      },
    });

    this.logger.debug(
      `Context assembled for user ${userId}: ${enriched.length} investors, ${prior.length} prior decisions`,
    );

    return {
      founderProfile: {
        id: profile.id,
        appName: profile.appName,
        appDescription: profile.appDescription,
        targetMarket: profile.targetMarket,
        currentMRR: profile.currentMRR,
        stage: profile.stage,
        fundingGoal: profile.fundingGoal,
      },
      investorPipeline: enriched,
      priorFeatureDecisions: prior
        .filter((p) => p.verdict != null)
        .map((p) => ({
          feature: p.featureName,
          verdict: p.verdict!,
        })),
    };
  }
}
