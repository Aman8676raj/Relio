import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma';

export interface IntroPathResult {
  sourceContact: {
    id: string;
    name: string | null;
    email: string;
    warmthTier: string;
  };
  targetContact: {
    id: string;
    name: string | null;
    email: string;
    company: string | null;
  };
  strengthScore: number;
  sharedThreadCount: number;
  reasoning: string;
}

@Injectable()
export class IntroPathService {
  private readonly logger = new Logger(IntroPathService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Compute intro paths for a user by analyzing email co-occurrence.
   * Two contacts are "connected" if they appear as participants in the
   * same email thread (both as To/CC/BCC recipients alongside the user).
   */
  async computeIntroPaths(userId: string): Promise<number> {
    this.logger.log(`Computing intro paths for user ${userId}`);

    // Get all contacts with threads
    const contacts = await this.prisma.contact.findMany({
      where: { userId, isArchived: false, inclusionStatus: 'active' },
      select: {
        id: true,
        email: true,
        name: true,
        warmthScore: true,
        warmthTier: true,
        replyRate: true,
        lastContactedAt: true,
        totalEmails: true,
      },
    });

    if (contacts.length < 2) return 0;

    // Build a map: threadGmailId → Set<contactEmail>
    const threadParticipants = new Map<string, Set<string>>();

    // Get all message participants for this user
    const participants = await this.prisma.emailMessageParticipant.findMany({
      where: { userId },
      select: {
        email: true,
        message: { select: { gmailThreadId: true } },
      },
    });

    const contactEmails = new Set(contacts.map((c) => c.email.toLowerCase()));

    for (const p of participants) {
      const email = p.email.toLowerCase();
      if (!contactEmails.has(email)) continue;

      const threadId = p.message.gmailThreadId;
      if (!threadParticipants.has(threadId)) {
        threadParticipants.set(threadId, new Set());
      }
      threadParticipants.get(threadId)!.add(email);
    }

    // Build co-occurrence map: pairKey → sharedThreadCount
    const coOccurrence = new Map<
      string,
      { count: number; threads: string[] }
    >();

    for (const [threadId, emails] of threadParticipants) {
      const arr = [...emails];
      for (let i = 0; i < arr.length; i++) {
        for (let j = i + 1; j < arr.length; j++) {
          const key = [arr[i], arr[j]].sort().join('::');
          if (!coOccurrence.has(key)) {
            coOccurrence.set(key, { count: 0, threads: [] });
          }
          const entry = coOccurrence.get(key)!;
          entry.count++;
          if (entry.threads.length < 5) entry.threads.push(threadId);
        }
      }
    }

    // Build a contact lookup by email
    const contactByEmail = new Map(
      contacts.map((c) => [c.email.toLowerCase(), c]),
    );

    // Score and upsert intro paths
    let pathCount = 0;

    for (const [key, data] of coOccurrence) {
      const [email1, email2] = key.split('::');
      const c1 = contactByEmail.get(email1);
      const c2 = contactByEmail.get(email2);
      if (!c1 || !c2) continue;

      // Score: threadCount * 20 + avg warmth * 0.3 + recency bonus
      const avgWarmth = ((c1.warmthScore || 0) + (c2.warmthScore || 0)) / 2;
      const recencyBonus = this.getRecencyBonus(
        c1.lastContactedAt,
        c2.lastContactedAt,
      );
      const strengthScore = Math.min(
        100,
        data.count * 20 + avgWarmth * 0.3 + recencyBonus,
      );

      const reasoning = this.buildReasoning(c1, c2, data.count);

      await this.prisma.introPath.upsert({
        where: {
          uq_intro_path: {
            userId,
            sourceContactId: c1.id,
            targetContactId: c2.id,
          },
        },
        update: {
          strengthScore,
          sharedThreadCount: data.count,
          reasoning,
          computedAt: new Date(),
        },
        create: {
          userId,
          sourceContactId: c1.id,
          targetContactId: c2.id,
          strengthScore,
          sharedThreadCount: data.count,
          reasoning,
          computedAt: new Date(),
        },
      });

      pathCount++;
    }

    this.logger.log(`Computed ${pathCount} intro paths for user ${userId}`);
    return pathCount;
  }

  /**
   * Get intro paths for a specific contact
   */
  async getIntroPathsForContact(
    userId: string,
    contactId: string,
  ): Promise<IntroPathResult[]> {
    const paths = await this.prisma.introPath.findMany({
      where: {
        userId,
        OR: [{ sourceContactId: contactId }, { targetContactId: contactId }],
      },
      orderBy: { strengthScore: 'desc' },
      take: 10,
    });

    const contactIds = new Set<string>();
    for (const p of paths) {
      contactIds.add(p.sourceContactId);
      contactIds.add(p.targetContactId);
    }

    const contacts = await this.prisma.contact.findMany({
      where: { id: { in: [...contactIds] }, inclusionStatus: 'active' },
      select: {
        id: true,
        name: true,
        email: true,
        company: true,
        warmthTier: true,
      },
    });
    const contactMap = new Map(contacts.map((c) => [c.id, c]));

    return paths.map((p) => {
      const isSource = p.sourceContactId === contactId;
      const otherContactId = isSource ? p.targetContactId : p.sourceContactId;
      const sourceContact = contactMap.get(
        isSource ? p.sourceContactId : p.targetContactId,
      )!;
      const targetContact = contactMap.get(otherContactId)!;

      return {
        sourceContact: {
          id: sourceContact.id,
          name: sourceContact.name,
          email: sourceContact.email,
          warmthTier: sourceContact.warmthTier,
        },
        targetContact: {
          id: targetContact.id,
          name: targetContact.name,
          email: targetContact.email,
          company: targetContact.company,
        },
        strengthScore: p.strengthScore,
        sharedThreadCount: p.sharedThreadCount,
        reasoning: p.reasoning,
      };
    });
  }

  /**
   * Get top intro paths across all pipeline contacts
   */
  async getTopIntroPaths(userId: string): Promise<IntroPathResult[]> {
    const paths = await this.prisma.introPath.findMany({
      where: { userId },
      orderBy: { strengthScore: 'desc' },
      take: 20,
    });

    const contactIds = new Set<string>();
    for (const p of paths) {
      contactIds.add(p.sourceContactId);
      contactIds.add(p.targetContactId);
    }

    const contacts = await this.prisma.contact.findMany({
      where: { id: { in: [...contactIds] }, inclusionStatus: 'active' },
      select: {
        id: true,
        name: true,
        email: true,
        company: true,
        warmthTier: true,
      },
    });
    const contactMap = new Map(contacts.map((c) => [c.id, c]));

    return paths
      .map((p) => {
        const sourceContact = contactMap.get(p.sourceContactId);
        const targetContact = contactMap.get(p.targetContactId);
        if (!sourceContact || !targetContact) return null;

        return {
          sourceContact: {
            id: sourceContact.id,
            name: sourceContact.name,
            email: sourceContact.email,
            warmthTier: sourceContact.warmthTier,
          },
          targetContact: {
            id: targetContact.id,
            name: targetContact.name,
            email: targetContact.email,
            company: targetContact.company,
          },
          strengthScore: p.strengthScore,
          sharedThreadCount: p.sharedThreadCount,
          reasoning: p.reasoning,
        };
      })
      .filter(Boolean) as IntroPathResult[];
  }

  // ─── Helpers ──────────────────────────────────────────────────────────

  private getRecencyBonus(date1: Date | null, date2: Date | null): number {
    const now = Date.now();
    let bonus = 0;
    if (date1) {
      const days = (now - date1.getTime()) / (1000 * 60 * 60 * 24);
      if (days < 7) bonus += 15;
      else if (days < 30) bonus += 10;
      else if (days < 90) bonus += 5;
    }
    if (date2) {
      const days = (now - date2.getTime()) / (1000 * 60 * 60 * 24);
      if (days < 7) bonus += 15;
      else if (days < 30) bonus += 10;
      else if (days < 90) bonus += 5;
    }
    return bonus;
  }

  private buildReasoning(
    c1: { name: string | null; email: string; totalEmails: number },
    c2: { name: string | null; email: string; totalEmails: number },
    sharedThreads: number,
  ): string {
    const name1 = c1.name || c1.email.split('@')[0];
    const name2 = c2.name || c2.email.split('@')[0];
    const parts: string[] = [];
    parts.push(
      `${name1} and ${name2} share ${sharedThreads} email thread${sharedThreads !== 1 ? 's' : ''}`,
    );
    if (c1.totalEmails > 5 || c2.totalEmails > 5) {
      parts.push(`(${c1.totalEmails} + ${c2.totalEmails} total emails)`);
    }
    return parts.join(' ');
  }
}
