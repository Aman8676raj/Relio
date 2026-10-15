import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { PrismaService } from '../prisma';
import { DiagnosticsNarrativeInput, DropoutTopic, StageDropoutRate } from '../common/interfaces';

@Injectable()
export class DiagnosticsService {
  private readonly logger = new Logger(DiagnosticsService.name);
  private readonly claude: Anthropic;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.claude = new Anthropic({ apiKey: this.config.get('ANTHROPIC_API_KEY') });
  }

  async getLatestReport(userId: string) {
    return this.prisma.diagnosticsReport.findFirst({
      where: { userId },
      orderBy: { reportDate: 'desc' },
    });
  }

  async generateWeeklyReport(userId: string) {
    this.logger.log(`Generating diagnostics for user ${userId}`);

    // Check if a report already exists for today — avoid burning API credits
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const existing = await this.prisma.diagnosticsReport.findFirst({
      where: { userId, reportDate: { gte: today } },
    });
    if (existing) {
      this.logger.log(`Report already exists for today, returning cached`);
      return existing;
    }

    // 1. Stage dropout rates
    const dropoutByStage = await this.calculateDropoutRates(userId);

    // 2. Topic correlation from passed/ghosted contacts
    const topDropoutTopics = await this.extractDropoutTopics(userId);

    // 3. Phrase performance from sequence emails
    const { high: highPerformingPhrases, low: lowPerformingPhrases } =
      await this.analyzeSequencePhrases(userId);

    // 4. Velocity trend
    const velocityTrend = await this.calculateVelocityTrend(userId);

    // 5. Claude narrative
    const narrativeSummary = await this.generateNarrative({
      dropoutByStage,
      topDropoutTopics,
      highPerformingPhrases,
      lowPerformingPhrases,
      velocityTrend,
    });

    return this.prisma.diagnosticsReport.create({
      data: {
        userId,
        dropoutByStage: dropoutByStage as any,
        topDropoutTopics: topDropoutTopics as any,
        highPerformingPhrases: highPerformingPhrases as any,
        lowPerformingPhrases: lowPerformingPhrases as any,
        velocityTrend,
        narrativeSummary,
      },
    });
  }

  private async calculateDropoutRates(userId: string): Promise<Record<string, StageDropoutRate>> {
    const stages = ['intro', 'meeting', 'dd', 'term_sheet'];
    const result: Record<string, StageDropoutRate> = {};

    const events = await this.prisma.pipelineEvent.findMany({
      where: { userId },
    });

    for (const stage of stages) {
      const entered = events.filter((e) => e.toStage === stage).length;
      // Dropped out = went to closed_lost or paused from this stage
      const droppedOut = events.filter(
        (e) =>
          e.fromStage === stage &&
          (e.toStage === 'closed_lost' || e.toStage === 'paused'),
      ).length;

      result[stage] = {
        entered,
        droppedOut,
        rate: entered > 0 ? parseFloat((droppedOut / entered).toFixed(2)) : 0,
      };
    }

    return result;
  }

  private async extractDropoutTopics(userId: string): Promise<DropoutTopic[]> {
    // Get contacts that ended in closed_lost or paused
    const lostContacts = await this.prisma.contact.findMany({
      where: {
        userId,
        pipelineStage: { in: ['closed_lost', 'paused'] },
      },
      select: { id: true, name: true },
    });

    if (lostContacts.length < 3) {
      return [{ topic: 'Insufficient data', dropoutRate: 0 }];
    }

    const threads = await this.prisma.emailThread.findMany({
      where: {
        userId,
        contactId: { in: lostContacts.map((c) => c.id) },
      },
      select: { fullContent: true, subject: true },
      take: 20,
    });

    const threadContent = threads
      .map((t) => `Subject: ${t.subject ?? ''}\n${(t.fullContent ?? '').slice(0, 500)}`)
      .join('\n\n---\n\n');

    if (!threadContent.trim()) {
      return [{ topic: 'No thread data available', dropoutRate: 0 }];
    }

    try {
      const response = await this.claude.messages.create({
        model: 'claude-opus-4-5',
        max_tokens: 400,
        messages: [
          {
            role: 'user',
            content: `Analyze these email threads from investor conversations that ended negatively (no deal). 
Identify the top 3-5 topics or concerns that appeared in threads that died.

Threads:
${threadContent.slice(0, 3000)}

Return JSON only:
[{"topic": "string", "dropoutRate": 0.0-1.0, "note": "brief explanation"}]`,
          },
        ],
      });

      const text = response.content[0].type === 'text' ? response.content[0].text : '[]';
      const match = text.match(/\[[\s\S]*\]/);
      return match ? JSON.parse(match[0]) : [];
    } catch {
      return [{ topic: 'Analysis unavailable', dropoutRate: 0 }];
    }
  }

  private async analyzeSequencePhrases(userId: string) {
    const emails = await this.prisma.sequenceEmail.findMany({
      where: {
        enrollment: { userId },
        status: { in: ['sent', 'opened', 'replied'] },
      },
      select: { body: true, status: true },
      take: 200,
    });

    const replied = emails.filter((e) => e.status === 'replied');
    const noReply = emails.filter((e) => e.status === 'sent' || e.status === 'opened');

    if (replied.length < 3 || noReply.length < 3) {
      return {
        high: ['Insufficient data to identify high-performing phrases'],
        low: ['Insufficient data to identify low-performing phrases'],
      };
    }

    try {
      const response = await this.claude.messages.create({
        model: 'claude-opus-4-5',
        max_tokens: 400,
        messages: [
          {
            role: 'user',
            content: `Compare these two sets of investor outreach emails — those that got replies vs those that didn't.
Identify 3 phrases or approaches from each group.

EMAILS THAT GOT REPLIES:
${replied
  .slice(0, 5)
  .map((e) => (e.body ?? '').slice(0, 300))
  .join('\n---\n')}

EMAILS WITH NO REPLY:
${noReply
  .slice(0, 5)
  .map((e) => (e.body ?? '').slice(0, 300))
  .join('\n---\n')}

Return JSON only:
{"high": ["phrase1", "phrase2", "phrase3"], "low": ["phrase1", "phrase2", "phrase3"]}`,
          },
        ],
      });

      const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
      const match = text.match(/\{[\s\S]*\}/);
      return match ? JSON.parse(match[0]) : { high: [], low: [] };
    } catch {
      return { high: [], low: [] };
    }
  }

  private async calculateVelocityTrend(userId: string): Promise<string> {
    const recentWeeks = 4;
    const priorWeeks = 4;

    const recentCutoff = new Date();
    recentCutoff.setDate(recentCutoff.getDate() - recentWeeks * 7);

    const priorCutoff = new Date();
    priorCutoff.setDate(priorCutoff.getDate() - (recentWeeks + priorWeeks) * 7);

    const recentCount = await this.prisma.pipelineEvent.count({
      where: { userId, toStage: 'meeting', createdAt: { gte: recentCutoff } },
    });

    const priorCount = await this.prisma.pipelineEvent.count({
      where: {
        userId,
        toStage: 'meeting',
        createdAt: { gte: priorCutoff, lt: recentCutoff },
      },
    });

    const recentRate = recentCount / recentWeeks;
    const priorRate = priorCount / priorWeeks;

    if (priorRate === 0) return 'stable';
    if (recentRate > priorRate * 1.1) return 'accelerating';
    if (recentRate < priorRate * 0.9) return 'decelerating';
    return 'stable';
  }

  private async generateNarrative(data: DiagnosticsNarrativeInput): Promise<string> {
    try {
      const response = await this.claude.messages.create({
        model: 'claude-opus-4-5',
        max_tokens: 400,
        messages: [
          {
            role: 'user',
            content: `Write a 1-paragraph fundraising coaching insight for a founder. 
Be specific and actionable. Mention numbers from the data. Don't pad. Sound like a sharp advisor.

Data:
- Stage dropout rates: ${JSON.stringify(data.dropoutByStage)}
- Topics in failed threads: ${JSON.stringify(data.topDropoutTopics?.slice(0, 3))}
- High-reply phrases: ${JSON.stringify(data.highPerformingPhrases?.slice(0, 3))}
- Low-reply phrases: ${JSON.stringify(data.lowPerformingPhrases?.slice(0, 3))}
- Velocity trend: ${data.velocityTrend}

Example tone: "7 of your last 9 investors dropped off after discussing CAC payback. Your replies on this topic average 4 paragraphs — investors who stayed engaged received 1 sentence with a number. Your round velocity is also decelerating: 2.1 meetings/week this month vs. 3.4 last month. Priority action: rebuild your CAC response."

Return only the paragraph, no headers.`,
          },
        ],
      });

      return response.content[0].type === 'text' ? response.content[0].text : '';
    } catch {
      return 'Unable to generate narrative. Check your data and try again.';
    }
  }
}
