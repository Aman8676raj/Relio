import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { PrismaService } from '../prisma';
import * as crypto from 'crypto';

const PROMPT_VERSION = 'v1.0';

const SYSTEM_PROMPT_TEMPLATE = `You are drafting an email on behalf of {user_name}. Write in first person as {user_name} — not as an assistant, not as a helper. You ARE them.

Contact: {contact_name} ({contact_email})
Last contacted: {days_ago} days ago
Relationship warmth: {warmth_tier}

STRICT RULES — violate any of these and the draft is rejected:
1. Reference something SPECIFIC from the email thread below. No generic openers.
2. Maximum 120 words. Count them.
3. ONE clear ask or update. Not two. Not three. One.
4. Never use: "circle back", "touch base", "ping", "hope you're well", "reaching out", "just wanted to", "following up on my last email"
5. No subject line — body text only.
6. Sound like a human wrote this at 8am between meetings. Not a PR email.

Email thread (most recent first):
---
{thread_content}
---

Write the email body only. No preamble. No "Here's a draft:". Just the email.`;

@Injectable()
export class DraftGeneratorService {
  private readonly logger = new Logger(DraftGeneratorService.name);
  private readonly client: Anthropic;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.client = new Anthropic({
      apiKey: this.configService.getOrThrow<string>('ANTHROPIC_API_KEY'),
    });
  }

  private truncateToTokens(text: string, maxTokens: number = 3000): string {
    // Approximate: 1 token ≈ 0.75 words
    const maxWords = Math.floor(maxTokens * 0.75);
    const words = text.split(/\s+/);
    if (words.length <= maxWords) return text;
    return words.slice(0, maxWords).join(' ') + '\n[truncated]';
  }

  private assembleThreadContext(
    threads: {
      subject: string | null;
      fullContent: string | null;
      snippet: string | null;
      lastMessageAt: Date | null;
    }[],
  ): string {
    const sorted = [...threads].sort(
      (a, b) =>
        (b.lastMessageAt?.getTime() || 0) - (a.lastMessageAt?.getTime() || 0),
    );
    return sorted
      .slice(0, 10)
      .map(
        (t) =>
          `[Thread: ${t.subject || '(no subject)'}]\n${t.fullContent || t.snippet || ''}`,
      )
      .join('\n\n---\n\n');
  }

  async *generateDraftStream(
    contactId: string,
    userId: string,
  ): AsyncGenerator<string> {
    const contact = await this.prisma.contact.findFirstOrThrow({
      where: { id: contactId, userId },
    });

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });

    const threads = await this.prisma.emailThread.findMany({
      where: { contactId },
      orderBy: { lastMessageAt: 'desc' },
      take: 10,
    });

    const daysAgo = contact.lastContactedAt
      ? Math.floor(
          (Date.now() - contact.lastContactedAt.getTime()) /
            (1000 * 60 * 60 * 24),
        )
      : 0;

    let threadContent = this.assembleThreadContext(threads);
    threadContent = this.truncateToTokens(threadContent, 2800);

    const prompt = SYSTEM_PROMPT_TEMPLATE.replace(
      '{user_name}',
      user.name || user.email,
    )
      .replace('{contact_name}', contact.name || contact.email)
      .replace('{contact_email}', contact.email)
      .replace('{days_ago}', String(daysAgo))
      .replace('{warmth_tier}', contact.warmthTier || 'unknown')
      .replace('{thread_content}', threadContent);

    // Create draft record before streaming
    const draftId = crypto.randomUUID();
    await this.prisma.draft.create({
      data: {
        id: draftId,
        userId,
        contactId,
        threadContextIds: threads.map((t) => t.id),
        promptVersion: PROMPT_VERSION,
      },
    });

    let fullText = '';

    const stream = this.client.messages.stream({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    });

    for await (const event of stream) {
      if (
        event.type === 'content_block_delta' &&
        event.delta.type === 'text_delta'
      ) {
        const text = event.delta.text;
        fullText += text;
        yield `data: ${JSON.stringify({ type: 'text', content: text })}\n\n`;
      }
    }

    // Store completed draft
    await this.prisma.draft.update({
      where: { id: draftId },
      data: { generatedText: fullText },
    });

    yield `data: ${JSON.stringify({ type: 'draft_id', content: draftId })}\n\n`;
    yield `data: ${JSON.stringify({ type: 'done' })}\n\n`;
  }

  /**
   * Non-streaming draft generation for dashboard preview.
   * Returns the full text directly (no SSE).
   */
  async generateDraftSync(contactId: string, userId: string): Promise<string> {
    const contact = await this.prisma.contact.findFirstOrThrow({
      where: { id: contactId, userId },
    });

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });

    const threads = await this.prisma.emailThread.findMany({
      where: { contactId },
      orderBy: { lastMessageAt: 'desc' },
      take: 10,
    });

    const daysAgo = contact.lastContactedAt
      ? Math.floor(
          (Date.now() - contact.lastContactedAt.getTime()) /
            (1000 * 60 * 60 * 24),
        )
      : 0;

    let prompt: string;

    if (threads.length > 0) {
      let threadContent = this.assembleThreadContext(threads);
      threadContent = this.truncateToTokens(threadContent, 2800);
      prompt = SYSTEM_PROMPT_TEMPLATE.replace(
        '{user_name}',
        user.name || user.email,
      )
        .replace('{contact_name}', contact.name || contact.email)
        .replace('{contact_email}', contact.email)
        .replace('{days_ago}', String(daysAgo))
        .replace('{warmth_tier}', contact.warmthTier || 'unknown')
        .replace('{thread_content}', threadContent);
    } else {
      // No thread history — use a simpler intro prompt
      prompt = `You are drafting an email on behalf of ${user.name || user.email}. Write in first person as them.

Contact: ${contact.name || contact.email} (${contact.email})
Company: ${contact.company || 'Unknown'}
Relationship warmth: ${contact.warmthTier || 'unknown'}

Write a brief, warm follow-up email (max 100 words). Sound natural and human. No generic openers.
Reference something relevant to their company or role if possible.
Body text only — no subject line, no preamble.`;
    }

    const response = await this.client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content
      .filter((block) => block.type === 'text' && 'text' in block)
      .map((block) => (block as { text: string }).text)
      .join('\n');

    return text;
  }
}
