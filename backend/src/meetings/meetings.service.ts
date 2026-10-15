import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google } from 'googleapis';
import Anthropic from '@anthropic-ai/sdk';
import { PrismaService } from '../prisma';
import { CalendarEvent, MeetingBriefContact } from '../common/interfaces';

@Injectable()
export class MeetingsService {
  private readonly logger = new Logger(MeetingsService.name);
  private readonly claude: Anthropic;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.claude = new Anthropic({ apiKey: this.config.get('ANTHROPIC_API_KEY') });
  }

  /** Get all meeting briefs for a user, ordered by meeting_at */
  async getBriefs(userId: string) {
    return this.prisma.meetingBrief.findMany({
      where: { userId },
      include: {
        contact: { select: { id: true, name: true, company: true, email: true } },
      },
      orderBy: { meetingAt: 'asc' },
    });
  }

  /** Mark brief as viewed */
  async markViewed(briefId: string, userId: string) {
    return this.prisma.meetingBrief.updateMany({
      where: { id: briefId, userId },
      data: { viewedAt: new Date() },
    });
  }

  /** Scan the next 7 days of Google Calendar and generate briefs T-24hr before */
  async syncCalendarAndGenerateBriefs(user: { id: string; googleAccessToken?: string | null; googleRefreshToken?: string | null }) {
    if (!user.googleAccessToken || !user.googleRefreshToken) {
      this.logger.warn(`User ${user.id} has no Google tokens — skipping calendar sync`);
      return;
    }

    const oauth2Client = new google.auth.OAuth2(
      this.config.get('GOOGLE_CLIENT_ID'),
      this.config.get('GOOGLE_CLIENT_SECRET'),
    );
    oauth2Client.setCredentials({
      access_token: user.googleAccessToken,
      refresh_token: user.googleRefreshToken,
    });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    const now = new Date();
    const sevenDaysOut = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    let events: CalendarEvent[] = [];
    try {
      const response = await calendar.events.list({
        calendarId: 'primary',
        timeMin: now.toISOString(),
        timeMax: sevenDaysOut.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
      });
      events = (response.data.items as unknown as CalendarEvent[]) ?? [];
    } catch (err) {
      this.logger.error(`Calendar fetch failed for user ${user.id}: ${err.message}`);
      return;
    }

    for (const event of events) {
      const startTime = event.start?.dateTime ?? event.start?.date;
      if (!startTime) continue;

      const meetingAt = new Date(startTime);
      const hoursUntilMeeting = (meetingAt.getTime() - now.getTime()) / (1000 * 60 * 60);

      // Only generate if meeting is within 25 hours (generous window around T-24)
      if (hoursUntilMeeting > 25 || hoursUntilMeeting < 0) continue;

      const attendeeEmails: string[] = (event.attendees ?? []).map((a) => a.email).filter(Boolean);

      for (const email of attendeeEmails) {
        const contact = await this.prisma.contact.findFirst({
          where: { userId: user.id, email },
        });

        if (!contact) continue;
        if (contact.pipelineStage === 'none' || contact.pipelineStage === 'closed_won' || contact.pipelineStage === 'closed_lost') continue;

        // Check if brief already exists for this event + contact
        const existing = await this.prisma.meetingBrief.findFirst({
          where: { userId: user.id, calendarEventId: event.id, contactId: contact.id },
        });
        if (existing) continue;

        try {
          await this.generateAndSaveBrief(user.id, contact, event.id!, meetingAt);
        } catch (err) {
          this.logger.error(`Brief generation failed for ${contact.id}: ${err.message}`);
        }
      }
    }
  }

  private async generateAndSaveBrief(
    userId: string,
    contact: MeetingBriefContact,
    calendarEventId: string,
    meetingAt: Date,
  ) {
    // Gather context
    const threads = await this.prisma.emailThread.findMany({
      where: { userId, contactId: contact.id },
      orderBy: { lastMessageAt: 'desc' },
      take: 5,
    });

    const recentMessages = await this.prisma.emailMessage.findMany({
      where: {
        userId,
        gmailThreadId: { in: threads.map((t) => t.gmailThreadId) },
      },
      orderBy: { sentAt: 'desc' },
      take: 10,
    });

    const briefing = await this.prisma.contactBriefing.findUnique({
      where: { contactId: contact.id },
    });

    const emailContext = recentMessages
      .map(
        (m) =>
          `[${m.direction.toUpperCase()} | ${m.sentAt?.toISOString().slice(0, 10)}]: ${(m.bodyText ?? '').slice(0, 400)}`,
      )
      .join('\n---\n');

    const prompt = `Generate a pre-meeting intelligence brief for a founder meeting with an investor.

Investor: ${contact.name ?? contact.email}${contact.company ? ` at ${contact.company}` : ''}
Pipeline stage: ${contact.pipelineStage}

${briefing ? `AI summary of relationship: ${briefing.summary}` : ''}
${briefing?.openQuestions?.length ? `Open questions they've asked: ${briefing.openQuestions.join('; ')}` : ''}
${briefing?.commitments ? `Our open commitments: ${JSON.stringify(briefing.commitments)}` : ''}

Recent email context:
${emailContext || '(no recent emails)'}

Format as clean markdown with exactly these sections:
## Who They Are
- (3 bullets max: role, fund, known focus)

## What We've Discussed
(2-3 bullets from email history)

## Their Open Questions
(bullet list — what they've asked that's not fully answered)

## Your Open Items
(what you committed to send or follow up on)

## Suggested Angle For This Meeting
(1 short paragraph — what to emphasize, how to position)

Keep total under 400 words. Designed to be read in 5 minutes.`;

    const response = await this.claude.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }],
    });

    const briefMarkdown =
      response.content[0].type === 'text' ? response.content[0].text : '';

    await this.prisma.meetingBrief.create({
      data: {
        userId,
        contactId: contact.id,
        calendarEventId,
        meetingAt,
        briefMarkdown,
      },
    });

    this.logger.log(`Brief generated for contact ${contact.id}, meeting at ${meetingAt.toISOString()}`);
  }
}
