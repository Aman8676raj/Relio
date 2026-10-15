import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { buildSynthesisPrompt } from './prompts/synthesis.prompt';
import type { FounderAnalysisContext } from './context-assembly.service';
import type { MarketResearch } from './market-intelligence.service';
import type { CreateAnalysisDto } from './dto/create-analysis.dto';

export interface FeatureAnalysisResult {
  verdict: 'build' | 'defer' | 'kill' | 'needs-validation';
  verdictReasoning: string;
  revenueImpact: {
    low: number;
    high: number;
    currency: 'USD';
    unit: 'MRR';
  };
  investorAlignmentScore: number;
  alignedInvestors: { name: string; firm: string; reason: string }[];
  marketPrecedents: { product: string; outcome: string; relevance: string }[];
  recommendations: { priority: number; action: string; rationale: string }[];
}

@Injectable()
export class SynthesisService {
  private readonly logger = new Logger(SynthesisService.name);
  private readonly claude: Anthropic;
  private readonly model: string;

  constructor(private readonly config: ConfigService) {
    this.claude = new Anthropic({
      apiKey: this.config.getOrThrow<string>('ANTHROPIC_API_KEY'),
    });
    this.model = this.config.get<string>('ANTHROPIC_MODEL') ?? 'claude-sonnet-4-20250514';
  }

  /**
   * Stage 3 — deterministic JSON synthesis. No tools. No web search.
   * Injects founder context + market research → structured FeatureAnalysisResult.
   * Uses Promise.race with a 30-second timeout (belt-and-suspenders).
   */
  async synthesize(
    ctx: FounderAnalysisContext,
    research: MarketResearch,
    dto: CreateAnalysisDto,
  ): Promise<FeatureAnalysisResult> {
    this.logger.log(`Stage 3: synthesizing analysis for "${dto.featureName}"`);
    const t0 = Date.now();

    const userMessage = [
      `FEATURE NAME: ${dto.featureName}`,
      `DESCRIPTION: ${dto.featureDescription}`,
      `CATEGORY: ${dto.featureCategory}`,
      `ESTIMATED BUILD TIME: ${dto.estimatedBuildDays != null ? `${dto.estimatedBuildDays} days` : 'not provided'}`,
      ``,
      `MARKET RESEARCH (from live web search):`,
      research.raw,
      ``,
      `Respond ONLY with raw JSON. No markdown. No preamble. No explanation after the JSON.`,
    ].join('\n');

    const claudeCall = this.claude.messages.create({
      model: this.model,
      max_tokens: 2000,
      system: buildSynthesisPrompt(ctx),
      messages: [{ role: 'user', content: userMessage }],
    });

    const TIMEOUT_MS = 30_000;
    const timeoutPromise = new Promise<'TIMEOUT'>((resolve) =>
      setTimeout(() => resolve('TIMEOUT'), TIMEOUT_MS),
    );

    let response: Anthropic.Message | 'TIMEOUT';
    try {
      response = await Promise.race([claudeCall, timeoutPromise]);
    } catch (err: any) {
      this.logger.error(`Stage 3 Claude call failed after ${Date.now() - t0}ms: ${err.message}`);
      throw new InternalServerErrorException(
        'Synthesis service failed. Check ANTHROPIC_API_KEY and model availability.',
      );
    }

    if (response === 'TIMEOUT') {
      this.logger.error(`Stage 3 TIMED OUT after ${Date.now() - t0}ms`);
      throw new InternalServerErrorException(
        'Synthesis timed out after 30 seconds.',
      );
    }

    const rawText =
      response.content.find((b): b is Anthropic.TextBlock => b.type === 'text')?.text ?? '{}';

    // Strip markdown code fences — Stage 3 may still wrap JSON in backticks
    const cleaned = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();

    try {
      const parsed = JSON.parse(cleaned) as FeatureAnalysisResult;

      // Validate required fields
      if (!parsed.verdict || !parsed.verdictReasoning || parsed.investorAlignmentScore == null) {
        throw new Error('Missing required fields in parsed result');
      }

      this.logger.log(`Stage 3 complete in ${Date.now() - t0}ms: verdict="${parsed.verdict}", alignment=${parsed.investorAlignmentScore}`);
      return parsed;
    } catch (err: any) {
      this.logger.error(`Stage 3 JSON parse failed. Raw output:\n${rawText}`);
      throw new InternalServerErrorException(
        'Stage 3 returned malformed JSON. The analysis could not be completed.',
      );
    }
  }
}
