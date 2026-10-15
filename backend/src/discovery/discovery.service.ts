import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma';
import { ScoringEngineService } from './scoring-engine.service';
import { UpdateStartupProfileDto, DiscoverySearchDto } from './dto/discovery.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class DiscoveryService {
  private readonly logger = new Logger(DiscoveryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly scoring: ScoringEngineService,
  ) {}

  // ─── Startup Profile CRUD ───────────────────────────────────────────────

  async getProfile(userId: string) {
    const profile = await this.prisma.startupProfile.findUnique({
      where: { userId },
    });
    return profile;
  }

  async upsertProfile(userId: string, dto: UpdateStartupProfileDto) {
    const profile = await this.prisma.startupProfile.upsert({
      where: { userId },
      create: { userId, ...dto },
      update: dto,
    });
    return profile;
  }

  // ─── Score a single investor for a user ─────────────────────────────────

  async scoreInvestor(userId: string, investorId: string) {
    const [profile, investor] = await Promise.all([
      this.prisma.startupProfile.findUnique({ where: { userId } }),
      this.prisma.investorRecord.findUnique({ where: { id: investorId } }),
    ]);

    if (!profile || !investor) return null;

    // 1. Portfolio fit
    const portfolioFit = this.scoring.calculatePortfolioFit(
      {
        stage: profile.stage || undefined,
        sector: profile.sector || undefined,
        subSector: profile.subSector || undefined,
        geography: profile.geography || undefined,
        raiseTargetUsd: profile.raiseTargetUsd || undefined,
      },
      {
        stageFocus: investor.stageFocus,
        sectorFocus: investor.sectorFocus,
        geography: investor.geography,
        typicalCheckMinUsd: investor.typicalCheckMinUsd,
        typicalCheckMaxUsd: investor.typicalCheckMaxUsd,
      },
    );

    // 2. Fund deployment status
    const deployment = this.scoring.classifyFundDeploymentStatus({
      isActivelyDeploying: investor.isActivelyDeploying,
      investmentCount18mo: investor.investmentCount18mo,
      lastKnownInvestmentDate: investor.lastKnownInvestmentDate,
      fundVintageYear: investor.fundVintageYear,
    });

    // 3. Thesis alignment (Claude or heuristic)
    const thesis = await this.scoring.scoreThesisAlignment(
      profile.description || '',
      investor.thesisSummary || investor.thesisRaw || null,
      investor.name,
    );

    // 4. Warm path score (from existing IntroPath data)
    const warmPath = await this.getWarmPathScore(userId, investor.name, investor.email);

    // 5. Composite
    const composite = this.scoring.computeComposite({
      portfolioFit,
      thesisAlignment: thesis.score,
      warmPath: warmPath.score,
      fundDeployment: deployment.score,
    });

    // Upsert discovery score
    const score = await this.prisma.discoveryScore.upsert({
      where: {
        uq_user_investor_score: {
          userId,
          investorRecordId: investorId,
        },
      },
      create: {
        userId,
        investorRecordId: investorId,
        portfolioFitScore: portfolioFit,
        thesisAlignmentScore: thesis.score,
        thesisAlignmentReason: thesis.reason,
        fundDeploymentStatus: deployment.status,
        warmPathScore: warmPath.score,
        warmPathSummary: warmPath.summary,
        compositeScore: composite,
        lastScoredAt: new Date(),
      },
      update: {
        portfolioFitScore: portfolioFit,
        thesisAlignmentScore: thesis.score,
        thesisAlignmentReason: thesis.reason,
        fundDeploymentStatus: deployment.status,
        warmPathScore: warmPath.score,
        warmPathSummary: warmPath.summary,
        compositeScore: composite,
        lastScoredAt: new Date(),
      },
    });

    return {
      ...score,
      investor: this.serializeInvestor(investor),
    };
  }

  // ─── Discovery Search (scored + filtered) ───────────────────────────────

  async search(userId: string, dto: DiscoverySearchDto) {
    const page = dto.page || 1;
    const limit = dto.limit || 20;
    const skip = (page - 1) * limit;
    const minScore = dto.minScore || 0;

    // Build investor filter
    const investorWhere = this.buildInvestorWhere(dto);

    // Check if user has scores cached
    const hasScores = await this.prisma.discoveryScore.count({
      where: { userId },
    });

    if (hasScores === 0) {
      // No scores yet — return investors with basic info and prompt for scoring
      const [data, total] = await Promise.all([
        this.prisma.investorRecord.findMany({
          where: investorWhere,
          orderBy: { dataQualityScore: 'desc' },
          skip,
          take: limit,
        }),
        this.prisma.investorRecord.count({ where: investorWhere }),
      ]);

      return {
        data: data.map((inv) => ({
          investor: this.serializeInvestor(inv),
          score: null,
          needsScoring: true,
        })),
        meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
        profileComplete: await this.isProfileComplete(userId),
      };
    }

    // Has scores — join investors with scores, sorted by composite
    const scores = await this.prisma.discoveryScore.findMany({
      where: {
        userId,
        compositeScore: { gte: minScore },
        investorRecord: investorWhere,
      },
      include: { investorRecord: true },
      orderBy: { compositeScore: 'desc' },
      skip,
      take: limit,
    });

    const total = await this.prisma.discoveryScore.count({
      where: {
        userId,
        compositeScore: { gte: minScore },
        investorRecord: investorWhere,
      },
    });

    return {
      data: scores.map((s) => ({
        investor: this.serializeInvestor(s.investorRecord),
        score: {
          composite: s.compositeScore,
          portfolioFit: s.portfolioFitScore,
          thesisAlignment: s.thesisAlignmentScore,
          thesisReason: s.thesisAlignmentReason,
          fundDeployment: s.fundDeploymentStatus,
          warmPath: s.warmPathScore,
          warmPathSummary: s.warmPathSummary,
          lastScored: s.lastScoredAt,
        },
        needsScoring: false,
      })),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
      profileComplete: true,
    };
  }

  // ─── Batch Score (background job or on-demand) ──────────────────────────

  async batchScore(userId: string, investorLimit: number = 100) {
    const profile = await this.prisma.startupProfile.findUnique({
      where: { userId },
    });

    if (!profile || !profile.stage || !profile.sector) {
      this.logger.warn(`Cannot batch score — profile incomplete for user ${userId}`);
      return { scored: 0, reason: 'Profile incomplete' };
    }

    // Get top investors by data quality that haven't been scored recently
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const investors = await this.prisma.investorRecord.findMany({
      where: {
        OR: [
          {
            discoveryScores: {
              none: { userId },
            },
          },
          {
            discoveryScores: {
              some: {
                userId,
                lastScoredAt: { lt: oneDayAgo },
              },
            },
          },
        ],
      },
      orderBy: { dataQualityScore: 'desc' },
      take: investorLimit,
    });

    this.logger.log(`Batch scoring ${investors.length} investors for user ${userId}`);
    let scored = 0;

    for (const investor of investors) {
      try {
        await this.scoreInvestor(userId, investor.id);
        scored++;
      } catch (err: any) {
        this.logger.error(`Failed to score investor ${investor.id}: ${err.message}`);
      }
    }

    this.logger.log(`Batch scoring complete: ${scored}/${investors.length} investors scored`);
    return { scored, total: investors.length };
  }

  // ─── Private helpers ────────────────────────────────────────────────────

  private async getWarmPathScore(
    userId: string,
    investorName: string,
    investorEmail: string | null,
  ): Promise<{ score: number; summary: string | null }> {
    // Look for IntroPath records that might connect to this investor
    // Search contacts by name or email match
    const contacts = await this.prisma.contact.findMany({
      where: {
        userId,
        inclusionStatus: 'active',
        OR: [
          { name: { contains: investorName, mode: 'insensitive' } },
          ...(investorEmail ? [{ email: investorEmail }] : []),
        ],
      },
      select: { id: true, name: true },
      take: 5,
    });

    if (contacts.length === 0) {
      return { score: 0, summary: null };
    }

    // Check intro paths involving these contacts
    const introPath = await this.prisma.introPath.findFirst({
      where: {
        userId,
        OR: [
          { sourceContactId: { in: contacts.map((c) => c.id) } },
          { targetContactId: { in: contacts.map((c) => c.id) } },
        ],
      },
      orderBy: { strengthScore: 'desc' },
    });

    if (introPath) {
      return {
        score: Math.round(introPath.strengthScore * 100),
        summary: `Warm intro path found (strength ${Math.round(introPath.strengthScore * 100)}%)`,
      };
    }

    // Contact exists but no intro path — still some value (they're in CRM)
    return {
      score: 20,
      summary: `${contacts[0].name} is in your contacts — potential warm connection.`,
    };
  }

  private async isProfileComplete(userId: string): Promise<boolean> {
    const profile = await this.prisma.startupProfile.findUnique({
      where: { userId },
    });
    if (!profile) return false;
    return !!(profile.stage && profile.sector && profile.description);
  }

  private buildInvestorWhere(dto: DiscoverySearchDto): Prisma.InvestorRecordWhereInput {
    const conditions: Prisma.InvestorRecordWhereInput[] = [];

    if (dto.search) {
      conditions.push({
        OR: [
          { name: { contains: dto.search, mode: 'insensitive' } },
          { fundName: { contains: dto.search, mode: 'insensitive' } },
          { thesisSummary: { contains: dto.search, mode: 'insensitive' } },
        ],
      });
    }

    if (dto.investorType) {
      conditions.push({ investorType: dto.investorType });
    }

    if (dto.stageFocus) {
      conditions.push({ stageFocus: { hasSome: dto.stageFocus.split(',').map((s) => s.trim()) } });
    }

    if (dto.sectorFocus) {
      conditions.push({ sectorFocus: { hasSome: dto.sectorFocus.split(',').map((s) => s.trim()) } });
    }

    if (dto.geography) {
      conditions.push({ geography: { hasSome: dto.geography.split(',').map((g) => g.trim()) } });
    }

    return conditions.length > 0 ? { AND: conditions } : {};
  }

  private serializeInvestor(record: any) {
    return {
      ...record,
      fundSizeUsd: record.fundSizeUsd ? record.fundSizeUsd.toString() : null,
    };
  }
}
