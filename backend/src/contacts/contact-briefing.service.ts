import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { PrismaService } from '../prisma';
import { Prisma } from '@prisma/client';
import { createHash } from 'crypto';

export interface CommitmentItem {
  text: string;
  direction: 'inbound' | 'outbound';
  extractedFrom: string;
  status: 'open' | 'dismissed' | 'completed';
}

interface BriefingResult {
  summary: string;
  keyFacts: string[];
  openQuestions: string[];
  commitments: CommitmentItem[];
  sentiment: string;
  lastMeetingMentioned: string | null;
}

const BRIEFING_PROMPT = `You are analyzing email threads between a founder and a contact. Extract structured intelligence.

Contact: {contact_name} ({contact_email})
Company: {contact_company}
Relationship warmth: {warmth_tier}

Email threads (most recent first):
---
{thread_content}
---

Respond in valid JSON only. No markdown, no code fences. Schema:
{
  "summary": "2-3 sentence relationship summary. What is the state of this relationship right now?",
  "keyFacts": ["Up to 5 facts. Things the founder needs to remember: what was discussed, what was shared, key details about this person."],
  "openQuestions": ["Up to 3 unresolved questions from the threads. Things left unanswered."],
  "commitments": [
    {
      "text": "What was promised",
      "direction": "inbound or outbound (who made the promise)",
      "extractedFrom": "Brief context: which thread/subject",
      "status": "open"
    }
  ],
  "sentiment": "one of: positive, neutral, cautious, cold",
  "lastMeetingMentioned": "Date or description of last meeting mentioned, or null"
}`;

@Injectable()
export class ContactBriefingService {
  private readonly logger = new Logger(ContactBriefingService.name);
  private readonly client: Anthropic;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.client = new Anthropic({
      apiKey: this.configService.getOrThrow<string>('ANTHROPIC_API_KEY'),
    });
  }

  private computeThreadHash(
    threads: { id: string; messageCount: number }[],
  ): string {
    const raw = threads
      .map((t) => `${t.id}:${t.messageCount}`)
      .sort()
      .join('|');
    return createHash('sha256').update(raw).digest('hex').substring(0, 64);
  }

  async getBriefing(contactId: string, userId: string) {
    const contact = await this.prisma.contact.findFirstOrThrow({
      where: { id: contactId, userId },
    });

    const threads = await this.prisma.emailThread.findMany({
      where: { contactId },
      orderBy: { lastMessageAt: 'desc' },
      take: 10,
    });

    const currentHash = this.computeThreadHash(threads);

    // Check cache
    const existing = await this.prisma.contactBriefing.findUnique({
      where: { contactId },
    });

    if (existing && existing.threadHashKey === currentHash) {
      return {
        ...this.formatBriefing(existing),
        cached: true,
      };
    }

    // Generate new briefing
    const threadContent = threads
      .map(
        (t) =>
          `[Thread: ${t.subject || '(no subject)'}]\n${t.fullContent || t.snippet || ''}`,
      )
      .join('\n\n---\n\n');

    // Truncate to ~3000 tokens
    const maxWords = 2200;
    const words = threadContent.split(/\s+/);
    const truncated =
      words.length > maxWords
        ? words.slice(0, maxWords).join(' ') + '\n[truncated]'
        : threadContent;

    const prompt = BRIEFING_PROMPT.replace(
      '{contact_name}',
      contact.name || contact.email,
    )
      .replace('{contact_email}', contact.email)
      .replace('{contact_company}', contact.company || 'Unknown')
      .replace('{warmth_tier}', contact.warmthTier)
      .replace('{thread_content}', truncated);

    const response = await this.client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content
      .filter((block) => block.type === 'text' && 'text' in block)
      .map((block) => (block as { text: string }).text)
      .join('');

    let result: BriefingResult;
    try {
      result = JSON.parse(text) as BriefingResult;
    } catch {
      this.logger.warn(
        `Failed to parse briefing JSON for contact ${contactId}`,
      );
      result = {
        summary: text.substring(0, 500),
        keyFacts: [],
        openQuestions: [],
        commitments: [],
        sentiment: 'neutral',
        lastMeetingMentioned: null,
      };
    }

    // Preserve existing commitment statuses
    if (existing) {
      const existingCommitments =
        (existing.commitments as unknown as CommitmentItem[]) || [];
      for (const newC of result.commitments) {
        const match = existingCommitments.find((ec) => ec.text === newC.text);
        if (match) {
          newC.status = match.status;
        }
      }
    }

    // Upsert briefing
    const briefing = await this.prisma.contactBriefing.upsert({
      where: { contactId },
      create: {
        contactId,
        userId,
        summary: result.summary,
        keyFacts: result.keyFacts,
        openQuestions: result.openQuestions,
        commitments: JSON.parse(
          JSON.stringify(result.commitments),
        ) as Prisma.InputJsonValue,
        sentiment: result.sentiment,
        lastMeetingMentioned: result.lastMeetingMentioned,
        threadHashKey: currentHash,
        generatedAt: new Date(),
      },
      update: {
        summary: result.summary,
        keyFacts: result.keyFacts,
        openQuestions: result.openQuestions,
        commitments: JSON.parse(
          JSON.stringify(result.commitments),
        ) as Prisma.InputJsonValue,
        sentiment: result.sentiment,
        lastMeetingMentioned: result.lastMeetingMentioned,
        threadHashKey: currentHash,
        generatedAt: new Date(),
      },
    });

    return {
      ...this.formatBriefing(briefing),
      cached: false,
    };
  }

  async updateCommitmentStatus(
    contactId: string,
    userId: string,
    commitmentIndex: number,
    status: 'open' | 'dismissed' | 'completed',
  ) {
    const briefing = await this.prisma.contactBriefing.findFirst({
      where: { contactId, userId },
    });

    if (!briefing) {
      return { success: false, error: 'No briefing found' };
    }

    const commitments =
      (briefing.commitments as unknown as CommitmentItem[]) || [];
    if (commitmentIndex < 0 || commitmentIndex >= commitments.length) {
      return { success: false, error: 'Invalid commitment index' };
    }

    commitments[commitmentIndex].status = status;

    await this.prisma.contactBriefing.update({
      where: { id: briefing.id },
      data: {
        commitments: JSON.parse(
          JSON.stringify(commitments),
        ) as Prisma.InputJsonValue,
      },
    });

    return { success: true, commitments };
  }

  private formatBriefing(briefing: {
    id: string;
    summary: string;
    keyFacts: string[];
    openQuestions: string[];
    commitments: unknown;
    sentiment: string;
    lastMeetingMentioned: string | null;
    generatedAt: Date;
  }) {
    return {
      id: briefing.id,
      summary: briefing.summary,
      keyFacts: briefing.keyFacts,
      openQuestions: briefing.openQuestions,
      commitments: briefing.commitments as CommitmentItem[],
      sentiment: briefing.sentiment,
      lastMeetingMentioned: briefing.lastMeetingMentioned,
      generatedAt: briefing.generatedAt,
    };
  }
}
