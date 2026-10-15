import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma';
import { Prisma, InvestorRecord } from '@prisma/client';
import { QueryInvestorsDto } from './dto/query-investors.dto';
import { InvestorSeedRecord, SerializedInvestorRecord } from '../common/interfaces';

@Injectable()
export class InvestorDatabaseService {
  private readonly logger = new Logger(InvestorDatabaseService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── List with filters + search + pagination ────────────────────────────

  async findAll(query: QueryInvestorsDto) {
    const page = query.page || 1;
    const limit = query.limit || 24;
    const skip = (page - 1) * limit;

    const where = this.buildWhereClause(query);
    const orderBy = this.buildOrderBy(query);

    const [data, total] = await Promise.all([
      this.prisma.investorRecord.findMany({
        where,
        orderBy,
        skip,
        take: limit,
      }),
      this.prisma.investorRecord.count({ where }),
    ]);

    return {
      data: data.map(this.serialize),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ─── Single investor ────────────────────────────────────────────────────

  async findOne(id: string) {
    const record = await this.prisma.investorRecord.findUnique({
      where: { id },
    });
    if (!record) return null;
    return this.serialize(record);
  }

  // ─── Aggregate filter options (for frontend dropdowns) ──────────────────

  async getFilterOptions() {
    // Get all distinct values for filter dropdowns
    const records = await this.prisma.investorRecord.findMany({
      select: {
        investorType: true,
        stageFocus: true,
        sectorFocus: true,
        geography: true,
        dataSourceTags: true,
      },
    });

    const investorTypes = new Set<string>();
    const stages = new Set<string>();
    const sectors = new Set<string>();
    const geographies = new Set<string>();
    const tags = new Set<string>();

    for (const r of records) {
      if (r.investorType) investorTypes.add(r.investorType);
      r.stageFocus.forEach((s) => stages.add(s));
      r.sectorFocus.forEach((s) => sectors.add(s));
      r.geography.forEach((g) => geographies.add(g));
      const recordTags = r.dataSourceTags as string[] | null;
      if (recordTags) recordTags.forEach((t) => tags.add(t));
    }

    return {
      investorTypes: [...investorTypes].sort(),
      stages: [...stages].sort(),
      sectors: [...sectors].sort(),
      geographies: [...geographies].sort(),
      tags: [...tags].sort(),
    };
  }

  // ─── Stats ──────────────────────────────────────────────────────────────

  async getStats() {
    const [total, activelyDeploying, avgQuality] = await Promise.all([
      this.prisma.investorRecord.count(),
      this.prisma.investorRecord.count({
        where: { isActivelyDeploying: true },
      }),
      this.prisma.investorRecord.aggregate({
        _avg: { dataQualityScore: true },
      }),
    ]);

    // Count by type
    const byType = await this.prisma.investorRecord.groupBy({
      by: ['investorType'],
      _count: true,
    });

    return {
      total,
      activelyDeploying,
      avgDataQuality: Math.round(avgQuality._avg.dataQualityScore || 0),
      byType: byType.map((t) => ({
        type: t.investorType || 'unknown',
        count: t._count,
      })),
    };
  }

  // ─── Seed from JSON ─────────────────────────────────────────────────────

  async seed(investors: InvestorSeedRecord[]): Promise<{ created: number; updated: number }> {
    let created = 0;
    let updated = 0;

    for (const inv of investors) {
      const qualityScore = this.computeDataQuality(inv);

      const data: Prisma.InvestorRecordCreateInput = {
        name: inv.name,
        email: inv.email || null,
        fundName: inv.fundName || inv.fund_name || null,
        fundSizeUsd: (inv.fundSizeUsd || inv.fund_size_usd)
          ? BigInt(inv.fundSizeUsd || inv.fund_size_usd || 0)
          : null,
        fundVintageYear: inv.fundVintageYear || inv.fund_vintage_year || null,
        investorType: inv.investorType || inv.investor_type || 'vc',
        stageFocus: inv.stageFocus || inv.stage_focus || [],
        sectorFocus: inv.sectorFocus || inv.sector_focus || [],
        geography: inv.geography || [],
        typicalCheckMinUsd: inv.typicalCheckMinUsd || inv.typical_check_min_usd || null,
        typicalCheckMaxUsd: inv.typicalCheckMaxUsd || inv.typical_check_max_usd || null,
        linkedinUrl: inv.linkedinUrl || inv.linkedin_url || null,
        twitterHandle: inv.twitterHandle || inv.twitter_handle || null,
        website: inv.website || null,
        photoUrl: inv.photoUrl || inv.photo_url || null,
        thesisRaw: inv.thesisRaw || inv.thesis_raw || null,
        thesisSummary: inv.thesisSummary || inv.thesis_summary || null,
        recentInvestments: inv.recentInvestments || inv.recent_investments || Prisma.JsonNull,
        investmentCount18mo: inv.investmentCount18mo || inv.investment_count_18mo || 0,
        lastKnownInvestmentDate: (inv.lastKnownInvestmentDate || inv.last_known_investment_date)
          ? new Date(inv.lastKnownInvestmentDate || inv.last_known_investment_date as string)
          : null,
        isActivelyDeploying: inv.isActivelyDeploying ?? inv.is_actively_deploying ?? true,
        crunchbaseId: inv.crunchbaseId || inv.crunchbase_id || null,
        dataQualityScore: qualityScore,
        lastEnrichedAt: new Date(),
      };

      // Upsert by crunchbase_id if present, otherwise create
      if (data.crunchbaseId) {
        const existing = await this.prisma.investorRecord.findFirst({
          where: { crunchbaseId: data.crunchbaseId },
        });

        if (existing) {
          await this.prisma.investorRecord.update({
            where: { id: existing.id },
            data,
          });
          updated++;
        } else {
          await this.prisma.investorRecord.create({ data });
          created++;
        }
      } else {
        await this.prisma.investorRecord.create({ data });
        created++;
      }
    }

    this.logger.log(`Seed complete: ${created} created, ${updated} updated`);
    return { created, updated };
  }

  // ─── Private helpers ────────────────────────────────────────────────────

  private buildWhereClause(query: QueryInvestorsDto): Prisma.InvestorRecordWhereInput {
    const conditions: Prisma.InvestorRecordWhereInput[] = [];

    // Text search
    if (query.search) {
      const term = query.search;
      conditions.push({
        OR: [
          { name: { contains: term, mode: 'insensitive' } },
          { fundName: { contains: term, mode: 'insensitive' } },
          { thesisSummary: { contains: term, mode: 'insensitive' } },
          { email: { contains: term, mode: 'insensitive' } },
        ],
      });
    }

    // Investor type
    if (query.investorType) {
      conditions.push({ investorType: query.investorType });
    }

    // Stage focus (any overlap)
    if (query.stageFocus) {
      const stages = query.stageFocus.split(',').map((s) => s.trim());
      conditions.push({ stageFocus: { hasSome: stages } });
    }

    // Sector focus (any overlap)
    if (query.sectorFocus) {
      const sectors = query.sectorFocus.split(',').map((s) => s.trim());
      conditions.push({ sectorFocus: { hasSome: sectors } });
    }

    // Geography (any overlap)
    if (query.geography) {
      const geos = query.geography.split(',').map((g) => g.trim());
      conditions.push({ geography: { hasSome: geos } });
    }

    // Check size range
    if (query.checkMin !== undefined) {
      conditions.push({
        OR: [
          { typicalCheckMaxUsd: { gte: query.checkMin } },
          { typicalCheckMaxUsd: null },
        ],
      });
    }
    if (query.checkMax !== undefined) {
      conditions.push({
        OR: [
          { typicalCheckMinUsd: { lte: query.checkMax } },
          { typicalCheckMinUsd: null },
        ],
      });
    }

    // Actively deploying
    if (query.activelyDeploying !== undefined) {
      conditions.push({ isActivelyDeploying: query.activelyDeploying });
    }

    // Data source tags (JSONB array contains)
    if (query.tags) {
      const requestedTags = query.tags.split(',').map((t) => t.trim());
      for (const tag of requestedTags) {
        conditions.push({
          dataSourceTags: {
            array_contains: [tag],
          },
        } as any);
      }
    }

    return conditions.length > 0 ? { AND: conditions } : {};
  }

  private buildOrderBy(
    query: QueryInvestorsDto,
  ): Prisma.InvestorRecordOrderByWithRelationInput {
    const dir = query.sortDir === 'desc' ? 'desc' : 'asc';
    const field = query.sortBy || 'name';

    const validFields = [
      'name', 'fundName', 'dataQualityScore', 'lastEnrichedAt',
      'investmentCount18mo', 'createdAt', 'fundSizeUsd',
    ];

    if (validFields.includes(field)) {
      return { [field]: dir } as Prisma.InvestorRecordOrderByWithRelationInput;
    }
    return { name: 'asc' };
  }

  private computeDataQuality(inv: InvestorSeedRecord): number {
    let score = 0;
    const checks = [
      inv.name, inv.email, inv.fundName || inv.fund_name,
      inv.investorType || inv.investor_type,
      (inv.stageFocus || inv.stage_focus || []).length > 0,
      (inv.sectorFocus || inv.sector_focus || []).length > 0,
      (inv.geography || []).length > 0,
      inv.typicalCheckMinUsd || inv.typical_check_min_usd,
      inv.typicalCheckMaxUsd || inv.typical_check_max_usd,
      inv.website,
      inv.linkedinUrl || inv.linkedin_url,
      inv.thesisSummary || inv.thesis_summary,
      inv.recentInvestments || inv.recent_investments,
    ];
    const total = checks.length;
    for (const c of checks) {
      if (c) score++;
    }
    return Math.round((score / total) * 100);
  }

  private serialize(record: InvestorRecord): SerializedInvestorRecord {
    return {
      ...record,
      investorType: record.investorType || 'unknown',
      // Convert BigInt to string for JSON serialization
      fundSizeUsd: record.fundSizeUsd ? record.fundSizeUsd.toString() : null,
    };
  }
}
