import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { PrismaService } from '../prisma';
import {
  SentimentContact,
  EmailMessageRecord,
  SentimentMetrics,
} from '../common/interfaces';

const ALERT_THRESHOLD = 3; // signals degrading simultaneously

@Injectable()
export class SentimentService {
  private readonly logger = new Logger(SentimentService.name);
  private readonly claude: Anthropic;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.claude = new Anthropic({
      apiKey: this.config.get('ANTHROPIC_API_KEY'),
    });
  }

  /** Get all active (non-dismissed) alerts for a user */
  async getAlerts(userId: string) {
    return this.prisma.sentimentAlert.findMany({
      where: { userId, dismissedAt: null },
      include: {
        contact: {
          select: { id: true, name: true, company: true, email: true },
        },
        snapshot: {
          select: {
            degradingSignals: true,
            avgReplyLatencyHours: true,
            avgReplyLengthWords: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Dismiss an alert */
  async dismissAlert(alertId: string, userId: string) {
    return this.prisma.sentimentAlert.updateMany({
      where: { id: alertId, userId },
      data: { dismissedAt: new Date() },
    });
  }

  /** Run full sentiment analysis for all active pipeline contacts of a user */
  async runAnalysisForUser(userId: string) {
    const contacts = await this.prisma.contact.findMany({
      where: {
        userId,
        isArchived: false,
        inclusionStatus: 'active',
        pipelineStage: { notIn: ['none', 'closed_won', 'closed_lost'] },
      },
      include: {
        threads: {
          orderBy: { lastMessageAt: 'desc' },
          take: 1,
        },
      },
    });

    for (const contact of contacts) {
      if (contact.threads.length === 0) continue;
      try {
        await this.analyzeContact(userId, contact);
      } catch (err) {
        this.logger.error(
          `Sentiment analysis failed for contact ${contact.id}: ${err.message}`,
        );
      }
    }
  }

  private async analyzeContact(userId: string, contact: SentimentContact) {
    // Get last 10 inbound messages from this contact
    const messages = await this.prisma.emailMessage.findMany({
      where: {
        userId,
        gmailThreadId: { in: contact.threads.map((t) => t.gmailThreadId) },
        direction: 'inbound',
      },
      orderBy: { sentAt: 'desc' },
      take: 10,
    });

    if (messages.length < 2) return; // not enough data

    const currentMetrics = this.computeMetrics(messages);

    const previous = await this.prisma.sentimentSnapshot.findFirst({
      where: { userId, contactId: contact.id },
      orderBy: { snapshotAt: 'desc' },
    });

    if (!previous) {
      // First snapshot — baseline only, no alert
      await this.prisma.sentimentSnapshot.create({
        data: {
          userId,
          contactId: contact.id,
          ...currentMetrics,
          degradingSignals: [],
        },
      });
      return;
    }

    // Diff against previous snapshot
    const degradingSignals = this.detectDegradation(currentMetrics, previous);

    let analysis: { summary: string; recommendedAction: string } | null = null;
    if (degradingSignals.length >= ALERT_THRESHOLD) {
      analysis = await this.claudeAnalyzeDegradation(
        contact,
        messages,
        degradingSignals,
      );
    }

    const snapshot = await this.prisma.sentimentSnapshot.create({
      data: {
        userId,
        contactId: contact.id,
        ...currentMetrics,
        degradingSignals,
        alertTriggered: degradingSignals.length >= ALERT_THRESHOLD,
        llmRawAnalysis: analysis ? JSON.stringify(analysis) : null,
        recommendedAction: analysis?.recommendedAction ?? null,
      },
    });

    if (degradingSignals.length >= ALERT_THRESHOLD && analysis) {
      await this.prisma.sentimentAlert.create({
        data: {
          userId,
          contactId: contact.id,
          snapshotId: snapshot.id,
          alertType: 'degradation',
          summary: analysis.summary,
          recommendedAction: analysis.recommendedAction,
        },
      });
      this.logger.log(
        `Sentiment alert created for contact ${contact.id} (${degradingSignals.length} signals)`,
      );
    }
  }

  private computeMetrics(messages: EmailMessageRecord[]): SentimentMetrics {
    // Average reply latency (hours between outbound and their reply)
    // Approximated from sentAt differences on inbound messages
    const latencies: number[] = [];
    for (let i = 0; i < messages.length - 1; i++) {
      const curSentAt = messages[i].sentAt;
      const nextSentAt = messages[i + 1].sentAt;
      if (curSentAt && nextSentAt) {
        const diff =
          (curSentAt.getTime() - nextSentAt.getTime()) / (1000 * 60 * 60);
        if (diff > 0 && diff < 720) latencies.push(diff); // cap at 30 days
      }
    }

    const wordCounts = messages
      .map((m) => m.bodyText?.split(/\s+/).length ?? 0)
      .filter((n) => n > 0);

    // Forward-looking language heuristic
    const forwardKeywords = [
      'let me check',
      'should meet',
      "let's",
      "let's",
      'schedule',
      'call',
      'follow up',
      'interested',
      'would love',
      'looking forward',
      'next step',
    ];
    const forwardScores = messages.map((m) => {
      const text = (m.bodyText ?? '').toLowerCase();
      const hits = forwardKeywords.filter((k) => text.includes(k)).length;
      return Math.min(hits / 2, 1);
    });

    // Question specificity — does their message contain diligence-level specifics?
    const diligenceTerms = [
      'gross margin',
      'churn',
      'ltv',
      'cac',
      'retention',
      'cohort',
      'nrr',
      'burn rate',
      'runway',
      'cap table',
      'references',
      'customers',
    ];
    const specificityScores = messages.map((m) => {
      const text = (m.bodyText ?? '').toLowerCase();
      const hits = diligenceTerms.filter((t) => text.includes(t)).length;
      return Math.min(hits / 3, 1);
    });

    return {
      avgReplyLatencyHours:
        latencies.length > 0
          ? latencies.reduce((a, b) => a + b, 0) / latencies.length
          : null,
      avgReplyLengthWords:
        wordCounts.length > 0
          ? wordCounts.reduce((a, b) => a + b, 0) / wordCounts.length
          : null,
      forwardLookingScore:
        forwardScores.length > 0
          ? forwardScores.reduce((a, b) => a + b, 0) / forwardScores.length
          : null,
      questionSpecificityScore:
        specificityScores.length > 0
          ? specificityScores.reduce((a, b) => a + b, 0) /
            specificityScores.length
          : null,
      proactiveReachOutCount: 0, // simplified — would need thread initiator logic
    };
  }

  private detectDegradation(
    current: SentimentMetrics,
    previous: SentimentMetrics,
  ): string[] {
    const signals: string[] = [];

    if (
      current.avgReplyLatencyHours &&
      previous.avgReplyLatencyHours &&
      current.avgReplyLatencyHours > previous.avgReplyLatencyHours * 1.5
    ) {
      signals.push('reply_latency_increasing');
    }

    if (
      current.avgReplyLengthWords &&
      previous.avgReplyLengthWords &&
      current.avgReplyLengthWords < previous.avgReplyLengthWords * 0.6
    ) {
      signals.push('reply_length_shrinking');
    }

    if (
      current.forwardLookingScore !== null &&
      previous.forwardLookingScore !== null &&
      current.forwardLookingScore < previous.forwardLookingScore * 0.5
    ) {
      signals.push('forward_looking_language_absent');
    }

    if (
      current.questionSpecificityScore !== null &&
      current.questionSpecificityScore < 0.2
    ) {
      signals.push('questions_becoming_generic');
    }

    if (
      current.proactiveReachOutCount === 0 &&
      previous.proactiveReachOutCount > 0
    ) {
      signals.push('proactive_contact_stopped');
    }

    return signals;
  }

  private async claudeAnalyzeDegradation(
    contact: SentimentContact,
    messages: EmailMessageRecord[],
    degradingSignals: string[],
  ): Promise<{ summary: string; recommendedAction: string }> {
    const recentEmails = messages
      .slice(0, 4)
      .map(
        (m) =>
          `[${m.direction.toUpperCase()} | ${m.sentAt?.toISOString().slice(0, 10)}]: ${(m.bodyText ?? '').slice(0, 300)}`,
      )
      .join('\n---\n');

    const response = await this.claude.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 300,
      messages: [
        {
          role: 'user',
          content: `An investor thread is showing engagement decline.

Contact: ${contact.name ?? contact.email} at ${contact.company ?? 'unknown fund'}
Degrading signals: ${degradingSignals.join(', ')}

Recent emails:
${recentEmails}

Return JSON only:
{
  "summary": "1-2 sentence plain English summary of what changed",
  "recommendedAction": "specific next step in max 20 words"
}`,
        },
      ],
    });

    try {
      const text =
        response.content[0].type === 'text' ? response.content[0].text : '{}';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      return jsonMatch
        ? JSON.parse(jsonMatch[0])
        : {
            summary: 'Engagement declining.',
            recommendedAction: 'Send a check-in message.',
          };
    } catch {
      return {
        summary: 'Engagement declining.',
        recommendedAction: 'Send a check-in message.',
      };
    }
  }
}
