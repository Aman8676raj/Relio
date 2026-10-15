import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { PrismaService } from '../prisma';
import type { Contact } from '@prisma/client';

export interface EnrichedInvestor {
  id: string;
  name: string | null;
  firm: string | null;
  status: string; // pipelineStage value
  contactType: string;
  portfolioFocus: string[];
  recentInvestments: string[];
}

@Injectable()
export class InvestorAlignmentService {
  private readonly logger = new Logger(InvestorAlignmentService.name);
  private readonly claude: Anthropic;
  private readonly model: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.claude = new Anthropic({
      apiKey: this.config.getOrThrow<string>('ANTHROPIC_API_KEY'),
    });
    this.model = this.config.get<string>('ANTHROPIC_MODEL') ?? 'claude-sonnet-4-20250514';
  }

  /**
   * Called when an investor contact is being assembled into context.
   * If portfolioFocus is already persisted, returns immediately (no API call).
   * Otherwise triggers a one-time Claude web search to extract their thesis,
   * persists the result on the Contact row, and returns the focus areas.
   */
  async enrichFromWeb(contact: Contact): Promise<EnrichedInvestor> {
    const existingFocus = contact.portfolioFocus as string[] | null;

    // Already enriched — skip API call entirely
    if (existingFocus && existingFocus.length > 0) {
      return this.toEnriched(contact, existingFocus);
    }

    // No firm name — nothing meaningful to search for
    if (!contact.company) {
      return this.toEnriched(contact, []);
    }

    this.logger.debug(
      `Enriching investor ${contact.id} (${contact.name ?? contact.email}) via web search`,
    );

    let portfolioFocus: string[] = [];

    try {
      const websiteHint = contact.crunchbaseUrl ?? `${contact.company.toLowerCase().replace(/\s+/g, '')}.com`;

      const response = await (this.claude.messages.create as Function)(
        {
          model: this.model,
          max_tokens: 500,
          system: `Extract investment thesis. Return ONLY a JSON array of 3-6 focus areas. Example: ["B2B SaaS","AI infrastructure","developer tools"]. Raw JSON only. No markdown.`,
          tools: [{ type: 'web_search_20250305', name: 'web_search' }],
          messages: [
            {
              role: 'user',
              content: `What does ${contact.name ?? 'this investor'} at ${contact.company} invest in? Their site: ${websiteHint}`,
            },
          ],
        },
        {
          headers: { 'anthropic-beta': 'web-search-2025-03-05' },
        },
      );

      const textBlock = (response as Anthropic.Message).content.find(
        (b: Anthropic.ContentBlock): b is Anthropic.TextBlock => b.type === 'text',
      );

      if (textBlock) {
        const cleaned = textBlock.text.replace(/```json|```/g, '').trim();
        const parsed = JSON.parse(cleaned);
        if (Array.isArray(parsed)) {
          portfolioFocus = parsed.filter((v): v is string => typeof v === 'string');
        }
      }
    } catch (err: any) {
      this.logger.warn(
        `Web enrichment failed for contact ${contact.id}: ${err.message} — using empty focus`,
      );
      return this.toEnriched(contact, []);
    }

    // Persist so this call never fires again for the same contact
    if (portfolioFocus.length > 0) {
      try {
        await this.prisma.contact.update({
          where: { id: contact.id },
          data: { portfolioFocus },
        });
        this.logger.debug(
          `Persisted portfolioFocus for ${contact.id}: ${portfolioFocus.join(', ')}`,
        );
      } catch (err: any) {
        this.logger.warn(`Failed to persist portfolioFocus for ${contact.id}: ${err.message}`);
      }
    }

    return this.toEnriched(contact, portfolioFocus);
  }

  private toEnriched(contact: Contact, portfolioFocus: string[]): EnrichedInvestor {
    return {
      id: contact.id,
      name: contact.name,
      firm: contact.company,
      status: contact.pipelineStage,
      contactType: contact.contactType,
      portfolioFocus,
      recentInvestments: [], // Phase 5+: populated from future signals
    };
  }
}
