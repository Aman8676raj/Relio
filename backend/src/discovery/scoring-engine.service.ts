import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';

export interface ThesisAlignmentResult {
  score: number;      // 0-100
  reason: string;     // Brief explanation
}

@Injectable()
export class ScoringEngineService {
  private readonly logger = new Logger(ScoringEngineService.name);
  private anthropic: Anthropic | null = null;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (apiKey) {
      this.anthropic = new Anthropic({ apiKey });
      this.logger.log('Anthropic client initialized for thesis alignment');
    } else {
      this.logger.warn('ANTHROPIC_API_KEY not set — thesis alignment scoring will use fallback heuristics');
    }
  }

  // ─── Portfolio Fit Score (0-100) ──────────────────────────────────────────

  calculatePortfolioFit(
    startup: { stage?: string; sector?: string; subSector?: string; geography?: string; raiseTargetUsd?: number },
    investor: { stageFocus: string[]; sectorFocus: string[]; geography: string[]; typicalCheckMinUsd?: number | null; typicalCheckMaxUsd?: number | null },
  ): number {
    let score = 0;
    let factors = 0;

    // Stage match (0 or 30)
    if (startup.stage && investor.stageFocus.length > 0) {
      factors++;
      const normalizedStage = startup.stage.toLowerCase().replace(/\s+/g, '-');
      if (investor.stageFocus.some((s) => s.toLowerCase() === normalizedStage)) {
        score += 30;
      }
    }

    // Sector match (0-30)
    if (startup.sector && investor.sectorFocus.length > 0) {
      factors++;
      const startupSectors = [startup.sector, startup.subSector].filter(Boolean).map((s) => s!.toLowerCase());

      // Exact match
      const exactMatch = investor.sectorFocus.some((s) =>
        startupSectors.some((ss) => s.toLowerCase() === ss),
      );
      if (exactMatch) {
        score += 30;
      } else {
        // Partial/related sector match
        const partialMatch = investor.sectorFocus.some((s) =>
          startupSectors.some(
            (ss) => s.toLowerCase().includes(ss) || ss.includes(s.toLowerCase()),
          ),
        );
        if (partialMatch) score += 15;
      }
    }

    // Geography match (0-20)
    if (startup.geography && investor.geography.length > 0) {
      factors++;
      const startupGeo = startup.geography.toLowerCase();
      if (investor.geography.some((g) => g.toLowerCase() === startupGeo || g.toLowerCase().includes(startupGeo) || startupGeo.includes(g.toLowerCase()))) {
        score += 20;
      }
    }

    // Check size match (0-20)
    if (startup.raiseTargetUsd && (investor.typicalCheckMinUsd || investor.typicalCheckMaxUsd)) {
      factors++;
      const min = investor.typicalCheckMinUsd || 0;
      const max = investor.typicalCheckMaxUsd || Infinity;
      if (startup.raiseTargetUsd >= min && startup.raiseTargetUsd <= max) {
        score += 20;
      } else {
        // Within 2x of range — partial credit
        if (startup.raiseTargetUsd >= min * 0.5 && startup.raiseTargetUsd <= max * 2) {
          score += 10;
        }
      }
    }

    // Normalize to 0-100
    const maxPossible = factors > 0 ? factors * (100 / 4) : 0;
    return maxPossible > 0 ? Math.round((score / maxPossible) * 100) : 50;
  }

  // ─── Fund Deployment Status (active/harvesting/unknown) ──────────────────

  classifyFundDeploymentStatus(
    investor: { isActivelyDeploying: boolean; investmentCount18mo: number; lastKnownInvestmentDate?: Date | string | null; fundVintageYear?: number | null },
  ): { status: string; score: number } {
    if (!investor.isActivelyDeploying) {
      return { status: 'harvesting', score: 10 };
    }

    // Recent investment activity
    if (investor.investmentCount18mo >= 5) {
      return { status: 'active', score: 100 };
    } else if (investor.investmentCount18mo >= 2) {
      return { status: 'active', score: 80 };
    } else if (investor.investmentCount18mo >= 1) {
      return { status: 'active', score: 60 };
    }

    // Check last known investment date
    if (investor.lastKnownInvestmentDate) {
      const date = new Date(investor.lastKnownInvestmentDate);
      const monthsAgo = (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24 * 30);
      if (monthsAgo <= 6) return { status: 'active', score: 70 };
      if (monthsAgo <= 12) return { status: 'active', score: 50 };
      if (monthsAgo <= 24) return { status: 'harvesting', score: 30 };
    }

    // Fund vintage check
    if (investor.fundVintageYear) {
      const yearsOld = new Date().getFullYear() - investor.fundVintageYear;
      if (yearsOld <= 2) return { status: 'active', score: 70 };
      if (yearsOld <= 4) return { status: 'active', score: 50 };
      return { status: 'harvesting', score: 20 };
    }

    return { status: 'unknown', score: 40 };
  }

  // ─── Thesis Alignment via Claude (0-100) ─────────────────────────────────

  async scoreThesisAlignment(
    startupDescription: string,
    investorThesis: string | null,
    investorName: string,
  ): Promise<ThesisAlignmentResult> {
    // If no thesis text, fallback
    if (!investorThesis || !startupDescription) {
      return { score: 50, reason: 'Insufficient data for thesis alignment.' };
    }

    // If Claude is available, use it
    if (this.anthropic) {
      try {
        return await this.callClaudeForThesis(startupDescription, investorThesis, investorName);
      } catch (err: any) {
        this.logger.error(`Claude thesis scoring failed for ${investorName}: ${err.message}`);
        return this.heuristicThesisScore(startupDescription, investorThesis);
      }
    }

    // Fallback to heuristic
    return this.heuristicThesisScore(startupDescription, investorThesis);
  }

  private async callClaudeForThesis(
    startupDescription: string,
    investorThesis: string,
    investorName: string,
  ): Promise<ThesisAlignmentResult> {
    const message = await this.anthropic!.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      messages: [
        {
          role: 'user',
          content: `You are an expert VC analyst. Score how well this startup aligns with this investor's thesis.

STARTUP DESCRIPTION:
${startupDescription.slice(0, 500)}

INVESTOR (${investorName}) THESIS:
${investorThesis.slice(0, 500)}

Respond in EXACTLY this JSON format, nothing else:
{"score": <0-100>, "reason": "<one sentence explanation>"}`,
        },
      ],
    });

    const text = message.content[0].type === 'text' ? message.content[0].text : '';
    try {
      const parsed = JSON.parse(text.trim());
      return {
        score: Math.max(0, Math.min(100, Math.round(parsed.score))),
        reason: parsed.reason || 'Thesis alignment analyzed.',
      };
    } catch {
      this.logger.warn(`Failed to parse Claude thesis response: ${text}`);
      return this.heuristicThesisScore(startupDescription, investorThesis);
    }
  }

  private heuristicThesisScore(startupDesc: string, thesis: string): ThesisAlignmentResult {
    const startupWords = new Set(startupDesc.toLowerCase().split(/\W+/).filter((w) => w.length > 3));
    const thesisWords = new Set(thesis.toLowerCase().split(/\W+/).filter((w) => w.length > 3));

    let overlap = 0;
    for (const w of startupWords) {
      if (thesisWords.has(w)) overlap++;
    }

    const score = Math.min(100, Math.round((overlap / Math.max(startupWords.size, 1)) * 200));
    return {
      score,
      reason: `Heuristic: ${overlap} keyword overlaps between startup description and investor thesis.`,
    };
  }

  // ─── Composite Score ─────────────────────────────────────────────────────

  computeComposite(scoreParts: {
    portfolioFit: number;
    thesisAlignment: number;
    warmPath: number;
    fundDeployment: number;
  }): number {
    // Weights: Portfolio 40%, Thesis 30%, Path 20%, Fund Status 10%
    const composite =
      scoreParts.portfolioFit * 0.4 +
      scoreParts.thesisAlignment * 0.3 +
      scoreParts.warmPath * 0.2 +
      scoreParts.fundDeployment * 0.1;
    return Math.round(composite);
  }
}
