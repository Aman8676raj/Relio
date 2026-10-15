import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { MARKET_INTELLIGENCE_PROMPT } from './prompts/market-intelligence.prompt';

export interface MarketResearch {
  raw: string;
  timedOut?: boolean;
}

@Injectable()
export class MarketIntelligenceService {
  private readonly logger = new Logger(MarketIntelligenceService.name);
  private readonly claude: Anthropic;
  private readonly model: string;

  constructor(private readonly config: ConfigService) {
    this.claude = new Anthropic({
      apiKey: this.config.getOrThrow<string>('ANTHROPIC_API_KEY'),
    });
    this.model = this.config.get<string>('ANTHROPIC_MODEL') ?? 'claude-sonnet-4-20250514';
  }

  /**
   * Stage 2 — calls Claude with web_search tool to gather live market intelligence.
   * Uses Promise.race with a 45-second hard timeout. If the timeout wins,
   * returns fallback research so the pipeline can still produce a verdict.
   */
  async research(featureDescription: string, featureCategory: string): Promise<MarketResearch> {
    this.logger.log(`Stage 2: running market research for category "${featureCategory}"`);
    const t0 = Date.now();

    const claudeCall = (this.claude.messages.create as Function)(
      {
        model: this.model,
        max_tokens: 2000,
        system: MARKET_INTELLIGENCE_PROMPT,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [
          {
            role: 'user',
            content: `Feature description: ${featureDescription}\nFeature category: ${featureCategory}`,
          },
        ],
      },
      {
        headers: {
          'anthropic-beta': 'web-search-2025-03-05',
        },
      },
    ) as Promise<Anthropic.Message>;

    const TIMEOUT_MS = 45_000;
    const timeoutPromise = new Promise<'TIMEOUT'>((resolve) =>
      setTimeout(() => resolve('TIMEOUT'), TIMEOUT_MS),
    );

    let response: Anthropic.Message | 'TIMEOUT';
    try {
      response = await Promise.race([claudeCall, timeoutPromise]);
    } catch (err: any) {
      const elapsed = Date.now() - t0;
      this.logger.error(`Stage 2 Claude call failed after ${elapsed}ms: ${err.message}`);
      throw new InternalServerErrorException(
        'Market intelligence service failed. Check ANTHROPIC_API_KEY and model availability.',
      );
    }

    if (response === 'TIMEOUT') {
      const elapsed = Date.now() - t0;
      this.logger.warn(`Stage 2 TIMED OUT after ${elapsed}ms — continuing with fallback research`);
      return {
        raw: 'Market research timed out after 45 seconds. The analysis will proceed with limited market context. No web search results are available for this feature.',
        timedOut: true,
      };
    }

    // Extract all text blocks (tool_use blocks are intermediate steps, not the final answer)
    const textBlocks = (response.content ?? [])
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n');

    if (!textBlocks) {
      this.logger.warn('Stage 2 returned no text content — using fallback placeholder');
      return { raw: 'No market research data was retrieved for this feature.' };
    }

    this.logger.log(`Stage 2 complete in ${Date.now() - t0}ms: ${textBlocks.length} chars of market research`);
    return { raw: textBlocks };
  }
}
