import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma';
import { PipelineStage } from '@prisma/client';

// ─── Signal Detection Patterns ─────────────────────────────────────────────

interface StageSignal {
  fromStage: PipelineStage;
  toStage: PipelineStage;
  patterns: RegExp[];
  friendlyLabel: string;
}

const STAGE_SIGNALS: StageSignal[] = [
  {
    fromStage: PipelineStage.intro,
    toStage: PipelineStage.meeting,
    patterns: [
      /\b(schedule|set up|book)\s+(a\s+)?(call|meeting|chat|zoom|sync)\b/i,
      /\b(meet|connect)\s+(next\s+)?(week|monday|tuesday|wednesday|thursday|friday)\b/i,
      /\b(calendar\s+invite|calendar\s+link)\b/i,
      /\b(zoom\.us|meet\.google|calendly|teams\.microsoft)\b/i,
      /\blet['']?s\s+(grab|get|hop\s+on)\s+(a\s+)?(coffee|call|chat)\b/i,
      /\b(looking\s+forward\s+to|see\s+you)\s+(on|at|next)\b/i,
    ],
    friendlyLabel: 'meeting scheduled',
  },
  {
    fromStage: PipelineStage.meeting,
    toStage: PipelineStage.dd,
    patterns: [
      /\b(due\s+diligence|DD\s+process)\b/i,
      /\b(send|share)\s+(me\s+)?(financials|cap\s+table|data\s+room)\b/i,
      /\b(pitch\s+deck|investor\s+deck|deck\s+update)\b/i,
      /\b(financial\s+model|revenue\s+breakdown|unit\s+economics)\b/i,
      /\b(want\s+to|like\s+to)\s+(dig|dive|look)\s+(deeper|further|into)\b/i,
      /\b(technical\s+review|product\s+demo|deep\s+dive)\b/i,
    ],
    friendlyLabel: 'due diligence initiated',
  },
  {
    fromStage: PipelineStage.dd,
    toStage: PipelineStage.term_sheet,
    patterns: [
      /\bterm\s*sheet\b/i,
      /\b(indicative\s+terms|proposed\s+terms)\b/i,
      /\b(LOI|letter\s+of\s+intent)\b/i,
      /\bwe['']?d\s+like\s+to\s+(proceed|move\s+forward|invest)\b/i,
      /\b(ready\s+to|prepared\s+to)\s+(make|extend)\s+(an\s+)?(offer|commitment)\b/i,
      /\b(valuation|pre-money|post-money)\b/i,
    ],
    friendlyLabel: 'term sheet discussion detected',
  },
];

// ─── Stage order for validation ─────────────────────────────────────────────

const STAGE_ORDER: PipelineStage[] = [
  PipelineStage.none,
  PipelineStage.intro,
  PipelineStage.meeting,
  PipelineStage.dd,
  PipelineStage.term_sheet,
  PipelineStage.closed_won,
];

function stageIndex(stage: PipelineStage): number {
  const idx = STAGE_ORDER.indexOf(stage);
  return idx === -1 ? -1 : idx;
}

@Injectable()
export class PipelineService {
  private readonly logger = new Logger(PipelineService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Unified stage change with audit trail ──────────────────────────────

  async moveStage(
    userId: string,
    contactId: string,
    toStage: PipelineStage,
    trigger: 'manual' | 'auto' | 'signal' = 'manual',
    reason?: string,
  ) {
    const contact = await this.prisma.contact.findFirst({
      where: { id: contactId, userId },
    });
    if (!contact) return null;

    const fromStage = contact.pipelineStage;
    if (fromStage === toStage) return contact;

    // Log the event
    await this.prisma.pipelineEvent.create({
      data: {
        userId,
        contactId,
        fromStage,
        toStage,
        trigger,
        reason: reason || `Manually moved from ${fromStage} to ${toStage}`,
      },
    });

    // Update the contact
    return this.prisma.contact.update({
      where: { id: contactId },
      data: {
        pipelineStage: toStage,
        pipelineUpdatedAt: new Date(),
      },
    });
  }

  // ─── Auto-progression signal detection ──────────────────────────────────

  async detectSignalsAndProgress(userId: string): Promise<number> {
    // Get all pipeline contacts (not in terminal states)
    const pipelineContacts = await this.prisma.contact.findMany({
      where: {
        userId,
        inclusionStatus: 'active',
        pipelineStage: {
          notIn: [
            PipelineStage.none,
            PipelineStage.closed_won,
            PipelineStage.closed_lost,
            PipelineStage.paused,
          ],
        },
        isArchived: false,
      },
    });

    if (pipelineContacts.length === 0) return 0;

    let moveCount = 0;

    for (const contact of pipelineContacts) {
      // Get recent messages (last 7 days)
      const recentMessages = await this.prisma.emailMessage.findMany({
        where: {
          userId,
          gmailThreadId: {
            in: await this.getContactThreadIds(userId, contact.id),
          },
          sentAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
        select: { bodyText: true, snippet: true, subject: true },
        orderBy: { sentAt: 'desc' },
        take: 20,
      });

      if (recentMessages.length === 0) continue;

      // Concatenate text for pattern matching
      const allText = recentMessages
        .map((m) =>
          [m.subject, m.snippet, m.bodyText].filter(Boolean).join(' '),
        )
        .join('\n');

      // Check each signal
      for (const signal of STAGE_SIGNALS) {
        if (contact.pipelineStage !== signal.fromStage) continue;

        // Ensure forward-only progression
        if (stageIndex(signal.toStage) <= stageIndex(contact.pipelineStage)) {
          continue;
        }

        // Check if any pattern matches
        const matchedPattern = signal.patterns.find((p) => p.test(allText));
        if (!matchedPattern) continue;

        // Check we haven't already auto-moved this contact recently
        const recentAutoMove = await this.prisma.pipelineEvent.findFirst({
          where: {
            contactId: contact.id,
            trigger: 'auto',
            toStage: signal.toStage,
            createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          },
        });
        if (recentAutoMove) continue;

        // Execute the move
        this.logger.log(
          `Auto-moving ${contact.name || contact.email}: ${signal.fromStage} → ${signal.toStage} (${signal.friendlyLabel})`,
        );

        await this.moveStage(
          userId,
          contact.id,
          signal.toStage,
          'auto',
          `AI detected: ${signal.friendlyLabel}`,
        );

        moveCount++;
        break; // Only one auto-move per contact per sync
      }
    }

    if (moveCount > 0) {
      this.logger.log(
        `Auto-progressed ${moveCount} contact(s) in pipeline for user ${userId}`,
      );
    }

    return moveCount;
  }

  // ─── Get stage change history ───────────────────────────────────────────

  async getContactEvents(userId: string, contactId: string) {
    return this.prisma.pipelineEvent.findMany({
      where: { userId, contactId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  // ─── Helper: get thread IDs for a contact ──────────────────────────────

  private async getContactThreadIds(
    userId: string,
    contactId: string,
  ): Promise<string[]> {
    const threads = await this.prisma.emailThread.findMany({
      where: { userId, contactId },
      select: { gmailThreadId: true },
    });
    return threads.map((t) => t.gmailThreadId);
  }

  // ─── Get Pipeline Velocity ──────────────────────────────────────────────
  async getVelocity(userId: string) {
    const contacts = await this.prisma.contact.findMany({
      where: {
        userId,
        pipelineStage: { not: PipelineStage.none },
        isArchived: false,
        inclusionStatus: 'active',
      },
    });

    const now = Date.now();
    const stageDefs = [
      { stage: PipelineStage.intro, label: 'Intro', color: 'var(--primary)' },
      {
        stage: PipelineStage.meeting,
        label: 'Meeting',
        color: 'var(--accent)',
      },
      {
        stage: PipelineStage.dd,
        label: 'Due Diligence',
        color: 'var(--warm-text)',
      },
      {
        stage: PipelineStage.term_sheet,
        label: 'Term Sheet',
        color: 'var(--success)',
      },
    ];

    const stages = stageDefs.map((def) => {
      const inStage = contacts.filter((c) => c.pipelineStage === def.stage);
      let avgDays = 0;
      if (inStage.length > 0) {
        const totalDays = inStage.reduce((sum, c) => {
          const start = c.pipelineUpdatedAt
            ? c.pipelineUpdatedAt.getTime()
            : c.lastContactedAt?.getTime() || now;
          return (
            sum + Math.max(0, Math.floor((now - start) / (1000 * 60 * 60 * 24)))
          );
        }, 0);
        avgDays = Math.round(totalDays / inStage.length);
      }
      return {
        stage: def.stage,
        label: def.label,
        avgDays: avgDays || 3, // fallback if 0 to show something
        contacts: inStage.length,
        color: def.color,
      };
    });

    const stuckContacts: any[] = [];
    contacts.forEach((c) => {
      const def = stages.find((s) => s.stage === c.pipelineStage);
      if (!def || !c.pipelineUpdatedAt) return;
      const days = Math.floor(
        (now - c.pipelineUpdatedAt.getTime()) / (1000 * 60 * 60 * 24),
      );
      if (days >= 14 && days > def.avgDays * 1.5) {
        stuckContacts.push({
          id: c.id,
          name: c.name || c.email,
          company: c.company || '',
          stage: c.pipelineStage,
          daysInStage: days,
          avgForStage: def.avgDays,
        });
      }
    });

    const closed = contacts.filter(
      (c) => c.pipelineStage === PipelineStage.closed_won,
    );
    let closedAvgDays = 0;
    if (closed.length > 0) {
      const total = closed.reduce((sum, c) => {
        const start = c.firstContactedAt
          ? c.firstContactedAt.getTime()
          : c.createdAt.getTime();
        const end = c.pipelineUpdatedAt ? c.pipelineUpdatedAt.getTime() : now;
        return sum + Math.floor((end - start) / (1000 * 60 * 60 * 24));
      }, 0);
      closedAvgDays = Math.round(total / closed.length);
    }

    return {
      stages,
      stuckContacts: stuckContacts
        .sort((a, b) => b.daysInStage - a.daysInStage)
        .slice(0, 5),
      totalAvgDays: stages.reduce((a, b) => a + b.avgDays, 0),
      closedAvgDays: closedAvgDays || 45,
    };
  }
}
