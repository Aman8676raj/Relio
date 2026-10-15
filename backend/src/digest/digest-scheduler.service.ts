import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma';
import { DigestService } from './digest.service';

@Injectable()
export class DigestSchedulerService {
  private readonly logger = new Logger(DigestSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly digestService: DigestService,
  ) {}

  /**
   * Runs every hour on the hour.
   * For each user with digest enabled, checks if current hour matches
   * their configured digest time (in their timezone). If so, sends digest.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async handleDigestCron(): Promise<void> {
    this.logger.log('Running digest cron job...');

    const users = await this.prisma.user.findMany({
      where: {
        googleRefreshToken: { not: null }, // only synced users
      },
      select: {
        id: true,
        email: true,
        timezone: true,
        preferences: true,
      },
    });

    let sentCount = 0;

    for (const user of users) {
      try {
        // Parse preferences to check digest settings
        const prefs = user.preferences as Record<
          string,
          Record<string, unknown>
        > | null;
        const notifPrefs = prefs?.notifications as
          | Record<string, unknown>
          | undefined;

        const digestEnabled = notifPrefs?.digestEnabled !== false; // default true
        if (!digestEnabled) continue;

        const digestTime = (notifPrefs?.digestTime as string) || '08:00 AM';
        const targetHour = this.parseDigestHour(digestTime);
        const currentHour = this.getCurrentHourInTimezone(
          user.timezone || 'UTC',
        );

        if (currentHour !== targetHour) continue;

        // Check if we already sent today
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const alreadySent = await this.prisma.digestLog.findFirst({
          where: {
            userId: user.id,
            emailSentAt: { gte: today },
          },
        });
        if (alreadySent) continue;

        // Send the digest — get nurture contacts first
        const nurtureContacts =
          await this.digestService.selectDigestContacts(user.id);
        if (nurtureContacts.length === 0) continue;

        await this.digestService.sendDigestEmail(
          { id: user.id, email: user.email, name: null },
          nurtureContacts,
        );
        sentCount++;

        this.logger.log(`Sent digest to ${user.email}`);
      } catch (err) {
        this.logger.error(
          `Failed to send digest to ${user.email}: ${err}`,
        );
      }
    }

    if (sentCount > 0) {
      this.logger.log(`Digest cron: sent ${sentCount} digest email(s)`);
    }
  }

  private parseDigestHour(timeStr: string): number {
    // Parses "08:00 AM" → 8, "07:30 AM" → 7, "09:00 AM" → 9
    const match = timeStr.match(/(\d{1,2}):?\d{0,2}\s*(AM|PM)?/i);
    if (!match) return 8;

    let hour = parseInt(match[1], 10);
    const ampm = match[2]?.toUpperCase();

    if (ampm === 'PM' && hour < 12) hour += 12;
    if (ampm === 'AM' && hour === 12) hour = 0;

    return hour;
  }

  private getCurrentHourInTimezone(timezone: string): number {
    try {
      const now = new Date();
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hour: 'numeric',
        hour12: false,
      });
      return parseInt(formatter.format(now), 10);
    } catch {
      return new Date().getUTCHours();
    }
  }
}
