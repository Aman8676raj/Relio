import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma';
import { WarmthTier } from '@prisma/client';

interface SendGridClient {
  setApiKey: (key: string) => void;
  send: (msg: {
    to: string;
    from: string;
    subject: string;
    text: string;
  }) => Promise<unknown>;
}

let sgMail: SendGridClient | null = null;
try {
  // Handle both ESM and CJS exports
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const sg = require('@sendgrid/mail') as
    | SendGridClient
    | { default: SendGridClient };
  sgMail = 'default' in sg ? sg.default : sg;
} catch {
  sgMail = null;
}

@Injectable()
export class DigestService {
  private readonly logger = new Logger(DigestService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    const apiKey = this.configService.get<string>('SENDGRID_API_KEY');
    if (apiKey && sgMail) {
      sgMail.setApiKey(apiKey);
    } else {
      this.logger.warn(
        'SendGrid not configured — digest emails will be skipped',
      );
    }
  }

  private getNotificationPreferences(preferences: unknown): {
    digestEnabled: boolean;
    digestTime: string;
  } {
    const prefs = preferences as Record<string, Record<string, unknown>> | null;
    const notifications = prefs?.notifications;
    const rawTime = notifications?.digestTime;
    return {
      digestEnabled: Boolean(notifications?.digestEnabled),
      digestTime: typeof rawTime === 'string' ? rawTime : '08:00 AM',
    };
  }

  private parseDigestHour(digestTime: string): number {
    const match = digestTime.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!match) return 8;

    let hour = parseInt(match[1], 10) % 12;
    const meridiem = match[3].toUpperCase();
    if (meridiem === 'PM') {
      hour += 12;
    }

    return hour;
  }

  private formatLocalDate(date: Date, timezone: string): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone || 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  }

  async selectDigestContacts(userId: string) {
    const now = new Date();
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    const contacts = await this.prisma.contact.findMany({
      where: {
        userId,
        isArchived: false,
        inclusionStatus: 'active',
        warmthTier: { in: [WarmthTier.warm, WarmthTier.cold] },
        lastContactedAt: {
          gte: sixtyDaysAgo,
          lte: fourteenDaysAgo,
        },
      },
    });

    // Sort: fastest-cooling first, then longest since contact
    contacts.sort((a, b) => {
      const trendA = (a.replyRate180d || 0) - (a.replyRate30d || 0);
      const trendB = (b.replyRate180d || 0) - (b.replyRate30d || 0);
      if (trendA !== trendB) return trendB - trendA;

      const monthlyBaselineA = (a.messagesLast180d || 0) / 6;
      const monthlyBaselineB = (b.messagesLast180d || 0) / 6;
      const coolingA = monthlyBaselineA - (a.messagesLast30d || 0);
      const coolingB = monthlyBaselineB - (b.messagesLast30d || 0);
      if (coolingA !== coolingB) return coolingB - coolingA;

      const scoreTrendA =
        (a.warmthScorePrevious || a.warmthScore || 0) - (a.warmthScore || 0);
      const scoreTrendB =
        (b.warmthScorePrevious || b.warmthScore || 0) - (b.warmthScore || 0);
      if (scoreTrendA !== scoreTrendB) return scoreTrendB - scoreTrendA;

      const timeA = a.lastContactedAt?.getTime() || 0;
      const timeB = b.lastContactedAt?.getTime() || 0;
      return timeA - timeB; // Oldest first
    });

    return contacts.slice(0, 3);
  }

  async sendDigestEmail(
    user: { id: string; email: string; name: string | null },
    contacts: {
      name: string | null;
      email: string;
      warmthTier: WarmthTier;
      lastContactedAt: Date | null;
    }[],
  ): Promise<void> {
    if (!sgMail) {
      this.logger.warn('SendGrid not configured — skipping digest send');
      return;
    }

    const lines = ['Good morning. Three relationships to nurture today:\n'];
    for (let i = 0; i < contacts.length; i++) {
      const contact = contacts[i];
      const days = contact.lastContactedAt
        ? Math.floor(
            (Date.now() - contact.lastContactedAt.getTime()) /
              (1000 * 60 * 60 * 24),
          )
        : '?';
      lines.push(
        `${i + 1}. ${contact.name || contact.email} — last contacted ${days} days ago (${contact.warmthTier})`,
      );
    }
    lines.push('\nOpen Founder CRM to draft your follow-ups.');

    const frontendUrl = this.configService.get<string>(
      'FRONTEND_URL',
      'http://localhost:3000',
    );
    lines.push(`\n${frontendUrl}`);

    try {
      await sgMail.send({
        to: user.email,
        from: 'digest@foundercrm.app',
        subject: '3 relationships to nurture today',
        text: lines.join('\n'),
      });
      this.logger.log(`Digest sent to ${user.email}`);
    } catch (error) {
      this.logger.error(`Failed to send digest to ${user.email}`, error);
      throw error;
    }
  }

  async processDigestsForHour(): Promise<number> {
    const users = await this.prisma.user.findMany();
    let sentCount = 0;

    for (const user of users) {
      try {
        const notificationPrefs = this.getNotificationPreferences(
          user.preferences,
        );
        if (!notificationPrefs.digestEnabled) continue;

        const targetHour = this.parseDigestHour(notificationPrefs.digestTime);
        const userLocalHour = this.getLocalHour(user.timezone);
        if (userLocalHour !== targetHour) continue;

        const latestDigest = await this.prisma.digestLog.findFirst({
          where: {
            userId: user.id,
          },
          orderBy: { emailSentAt: 'desc' },
        });

        if (
          latestDigest &&
          this.formatLocalDate(latestDigest.emailSentAt, user.timezone) ===
            this.formatLocalDate(new Date(), user.timezone)
        ) {
          continue;
        }

        const contacts = await this.selectDigestContacts(user.id);
        if (contacts.length === 0) continue;

        await this.sendDigestEmail(user, contacts);

        await this.prisma.digestLog.create({
          data: {
            userId: user.id,
            contactsSuggested: contacts.map((c) => c.id),
            emailSentAt: new Date(),
          },
        });

        sentCount++;
      } catch (error) {
        this.logger.error(
          `Failed to process digest for user ${user.id}`,
          error,
        );
      }
    }

    this.logger.log(`Morning digest: sent ${sentCount} emails`);
    return sentCount;
  }

  private getLocalHour(timezone: string): number {
    try {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone || 'UTC',
        hour: 'numeric',
        hour12: false,
      });
      return parseInt(formatter.format(new Date()), 10);
    } catch {
      return new Date().getUTCHours();
    }
  }

  async getDashboardDigest(userId: string) {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);

    const contacts = await this.prisma.contact.findMany({
      where: { userId, isArchived: false, inclusionStatus: 'active' },
    });

    // New replies since yesterday
    const newReplies = contacts.filter(
      (c) => c.lastInboundAt && c.lastInboundAt >= oneDayAgo,
    ).length;

    // New soft ghosts
    const softGhosts = contacts.filter((c) => {
      if (!c.lastOutboundAt || c.lastOutboundAt >= fiveDaysAgo) return false;
      return !c.lastInboundAt || c.lastInboundAt < c.lastOutboundAt;
    });

    // Contacts to nurture
    const nurtureContacts = await this.selectDigestContacts(userId);

    // Warmth momentum: average warmth delta
    const withDelta = contacts.filter(
      (c) => c.warmthScore != null && c.warmthScorePrevious != null,
    );
    const avgDelta =
      withDelta.length > 0
        ? Math.round(
            (withDelta.reduce(
              (sum, c) =>
                sum + ((c.warmthScore || 0) - (c.warmthScorePrevious || 0)),
              0,
            ) /
              withDelta.length) *
              10,
          ) / 10
        : 0;

    return {
      newReplies,
      newSoftGhosts: softGhosts.length,
      momentumDelta: avgDelta,
      nurtureContacts: nurtureContacts.map((c) => ({
        id: c.id,
        name: c.name,
        email: c.email,
        company: c.company,
        warmthTier: c.warmthTier,
        lastContactedAt: c.lastContactedAt,
        reason: this.getNurtureReason(c),
      })),
      generatedAt: new Date().toISOString(),
    };
  }

  private getNurtureReason(c: {
    warmthTier: string;
    lastContactedAt: Date | null;
    warmthScore: number | null;
    warmthScorePrevious: number | null;
    replyRate30d: number | null;
    replyRate180d: number | null;
  }): string {
    const daysSince = c.lastContactedAt
      ? Math.floor(
          (Date.now() - c.lastContactedAt.getTime()) / (1000 * 60 * 60 * 24),
        )
      : null;

    if (
      c.warmthScorePrevious != null &&
      c.warmthScore != null &&
      c.warmthScorePrevious - c.warmthScore >= 8
    ) {
      return `Warmth dropping — was ${Math.round(c.warmthScorePrevious)}, now ${Math.round(c.warmthScore)}`;
    }

    if (daysSince && daysSince >= 14) {
      return `${daysSince} days since last contact`;
    }

    if ((c.replyRate180d || 0) > (c.replyRate30d || 0)) {
      return 'Reply rate declining — relationship cooling';
    }

    return 'Due for a check-in';
  }
}
