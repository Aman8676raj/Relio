import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { PrismaService } from '../prisma';

interface GeneratedEmail {
  subject: string;
  body: string;
}

@Injectable()
export class SequenceGeneratorService {
  private readonly logger = new Logger(SequenceGeneratorService.name);
  private anthropic: Anthropic | null = null;
  private readonly backendUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (apiKey) {
      this.anthropic = new Anthropic({ apiKey });
    } else {
      this.logger.warn('ANTHROPIC_API_KEY not set — sequence email generation will use templates');
    }
    this.backendUrl = this.configService.get<string>('BACKEND_URL') || 'http://localhost:3001';
  }

  /**
   * Inject a 1px tracking pixel into the email body for open detection.
   */
  injectTrackingPixel(body: string, emailId: string): string {
    const pixelUrl = `${this.backendUrl}/api/sequences/track/${emailId}/pixel.gif`;
    const pixelTag = `\n\n<img src="${pixelUrl}" width="1" height="1" alt="" style="display:none" />`;
    return body + pixelTag;
  }

  async generateEmail(
    userId: string,
    contactId: string,
    emailType: 'opening' | 'followup' | 'breakup',
    subjectHint?: string,
  ): Promise<GeneratedEmail> {
    const [contact, user, profile] = await Promise.all([
      this.prisma.contact.findFirstOrThrow({ where: { id: contactId, userId } }),
      this.prisma.user.findUniqueOrThrow({ where: { id: userId } }),
      this.prisma.startupProfile.findUnique({ where: { userId } }),
    ]);

    // Try to find the matching investor record
    const investor = contact.email
      ? await this.prisma.investorRecord.findFirst({
          where: {
            OR: [
              { email: contact.email },
              { name: { contains: contact.name || '__impossible__', mode: 'insensitive' } },
            ],
          },
        })
      : null;

    // Check for intro paths
    const introPath = await this.prisma.introPath.findFirst({
      where: {
        userId,
        targetContactId: contactId,
      },
      orderBy: { strengthScore: 'desc' },
    });

    // Fetch source contact for intro path context
    let introPathContext: { sourceContactName: string | null; sourceContactEmail: string; strengthScore: number } | null = null;
    if (introPath) {
      const sourceContact = await this.prisma.contact.findUnique({
        where: { id: introPath.sourceContactId },
        select: { name: true, email: true },
      });
      if (sourceContact) {
        introPathContext = {
          sourceContactName: sourceContact.name,
          sourceContactEmail: sourceContact.email,
          strengthScore: introPath.strengthScore,
        };
      }
    }

    if (this.anthropic && profile) {
      return this.generateWithClaude(
        user,
        contact,
        profile,
        investor,
        introPathContext,
        emailType,
        subjectHint,
      );
    }

    return this.generateFallback(contact, emailType, subjectHint);
  }

  private async generateWithClaude(
    user: { name: string | null; email: string },
    contact: { name: string | null; email: string; company: string | null },
    profile: { name: string | null; stage: string | null; description: string | null; arrUsd: number | null; raiseTargetUsd: number | null },
    investor: { name: string; fundName: string | null; thesisSummary: string | null; recentInvestments: any } | null,
    introPath: { sourceContactName: string | null; sourceContactEmail: string; strengthScore: number } | null,
    emailType: string,
    subjectHint?: string,
  ): Promise<GeneratedEmail> {
    const typeInstructions: Record<string, string> = {
      opening: `Write a cold outreach email. Reference ONE specific thing about the investor (a recent deal, their thesis, or a shared connection). One clear ask: a 15-minute call. Max 150 words.`,
      followup: `Write a follow-up to an unreplied cold email. Add ONE new piece of value (traction update, press, or a relevant insight). Don't apologize for following up. Max 100 words.`,
      breakup: `Write a final "closing the loop" email. Short, dignified, low-pressure. Leave the door open. Max 80 words.`,
    };

    const investorContext = investor
      ? `Investor: ${investor.name} at ${investor.fundName || 'Unknown Fund'}
Their thesis: ${investor.thesisSummary || 'Unknown'}
Recent investments: ${JSON.stringify(investor.recentInvestments || []).slice(0, 300)}`
      : `Investor: ${contact.name || 'Unknown'} (${contact.email})`;

    const connectionContext = introPath?.sourceContactEmail
      ? `Shared connection: ${introPath.sourceContactName || introPath.sourceContactEmail} (relationship strength: ${Math.round(introPath.strengthScore * 100)}%)`
      : 'No shared connections found.';

    const prompt = `You are writing an email from ${user.name || user.email}, founder of ${profile.name || 'a startup'}.

Startup: ${profile.description || 'No description provided.'}
Stage: ${profile.stage || 'Unknown'}, ARR: ${profile.arrUsd ? `$${profile.arrUsd.toLocaleString()}` : 'Pre-revenue'}, Raising: ${profile.raiseTargetUsd ? `$${profile.raiseTargetUsd.toLocaleString()}` : 'TBD'}

${investorContext}

${connectionContext}

Email type: ${emailType}
${subjectHint ? `Subject line hint: ${subjectHint}` : ''}

${typeInstructions[emailType] || typeInstructions.opening}

STRICT RULES:
- Never say "I hope this finds you well", "passionate", "excited to", "reaching out", "touch base"
- Sound like a human founder, not a template or an AI
- Be specific, not generic
- First person as ${user.name || 'the founder'}

Return ONLY valid JSON: {"subject": "...", "body": "..."}`;

    try {
      const message = await this.anthropic!.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = message.content[0].type === 'text' ? message.content[0].text : '';
      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = text.match(/\{[\s\S]*?"subject"[\s\S]*?"body"[\s\S]*?\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          subject: parsed.subject || `Intro: ${profile.name || 'our company'}`,
          body: parsed.body || text,
        };
      }

      this.logger.warn('Failed to parse Claude response as JSON, using raw text');
      return {
        subject: subjectHint || `Intro: ${profile.name || 'our company'}`,
        body: text,
      };
    } catch (err: any) {
      this.logger.error(`Claude generation failed: ${err.message}`);
      return this.generateFallback({ name: contact.name, email: contact.email, company: contact.company }, emailType, subjectHint);
    }
  }

  private generateFallback(
    contact: { name: string | null; email: string; company: string | null },
    emailType: string,
    subjectHint?: string,
  ): GeneratedEmail {
    const contactName = contact.name?.split(' ')[0] || 'there';

    const templates: Record<string, GeneratedEmail> = {
      opening: {
        subject: subjectHint || `Quick question about your fund`,
        body: `Hi ${contactName},\n\nI've been following your investment activity and think there might be an interesting fit with what we're building.\n\nWould you have 15 minutes for a quick call this week?\n\nBest`,
      },
      followup: {
        subject: subjectHint || `Re: Quick question`,
        body: `Hi ${contactName},\n\nJust wanted to bump this — we've had some solid traction since my last note and I think the timing could be good for a conversation.\n\nHappy to work around your schedule.\n\nBest`,
      },
      breakup: {
        subject: subjectHint || `Closing the loop`,
        body: `Hi ${contactName},\n\nI know timing isn't always right. I'll leave the door open — if your fund is looking at this space in the future, I'd love to reconnect.\n\nAll the best`,
      },
    };

    return templates[emailType] || templates.opening;
  }
}
