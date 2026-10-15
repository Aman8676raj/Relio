import { Injectable, Logger } from '@nestjs/common';
import {
  EmailMessage,
  EmailMessageParticipant,
  MessageDirection,
  ParticipantRole,
} from '@prisma/client';
import { gmail_v1 } from 'googleapis';
import { convert } from 'html-to-text';
import { PrismaService } from '../prisma';
import { GoogleOAuthService } from '../auth/google-oauth.service';
import { WarmthService } from '../warmth/warmth.service';
import { PipelineService } from '../pipeline/pipeline.service';
import {
  ContactEvaluationHeader,
  ContactExclusionReason,
  ContactInclusionStatus,
  evaluateContact,
} from './contact-evaluation';

interface ParsedAddress {
  name: string;
  email: string;
}

interface ParsedMessage {
  gmailMessageId: string;
  gmailThreadId: string;
  subject: string;
  body: string;
  snippet: string;
  headers: ContactEvaluationHeader[];
  from: ParsedAddress;
  to: ParsedAddress[];
  cc: ParsedAddress[];
  bcc: ParsedAddress[];
  sentAt: Date;
  direction: MessageDirection;
  inReplyTo?: string;
}

interface RelationshipWindow {
  outboundAttempts: number;
  repliedAttempts: number;
  responseHours: number[];
}

interface ContactAggregate {
  name: string;
  firstContactedAt: Date | null;
  lastContactedAt: Date | null;
  totalEmails: number;
  inboundCount: number;
  outboundCount: number;
  threadIds: Set<string>;
  messagesLast30d: number;
  messagesLast90d: number;
  messagesLast180d: number;
  conversationDays30d: Set<string>;
  conversationDays90d: Set<string>;
  conversationDays180d: Set<string>;
  replyAll: RelationshipWindow;
  reply30d: RelationshipWindow;
  reply90d: RelationshipWindow;
  reply180d: RelationshipWindow;
  lastInboundAt: Date | null;
  lastOutboundAt: Date | null;
  userHasSent: boolean;
  contactHasReplied: boolean;
  relevantHeaders: ContactEvaluationHeader[];
}

interface ThreadAggregate {
  subject: string;
  messages: {
    timestamp: Date;
    fromEmail: string;
    body: string;
    snippet: string;
    externalParticipants: string[];
  }[];
  lastMessageAt: Date;
}

@Injectable()
export class GmailService {
  private readonly logger = new Logger(GmailService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly googleOAuth: GoogleOAuthService,
    private readonly warmthService: WarmthService,
    private readonly pipelineService: PipelineService,
  ) {}

  /**
   * Strip null bytes, lone surrogates, and other characters that Postgres
   * rejects ("unexpected end of hex escape"). Handles malformed content
   * from encoded email bodies, PDFs-in-email, etc.
   */
  private sanitizeText(text: string): string {
    return (
      text
        // Remove null bytes (\x00) — Postgres TEXT columns reject them
        .replace(/\x00/g, '')
        // Remove lone surrogates (invalid UTF-16 sequences)
        .replace(/[\uD800-\uDFFF]/g, '')
        // Remove other non-printable control chars (keep \t \n \r)
        .replace(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
        .trim()
    );
  }


  private parseEmailBody(payload: gmail_v1.Schema$MessagePart): string {
    let body = '';

    if (payload.mimeType === 'text/plain') {
      const data = payload.body?.data || '';
      if (data) {
        body = Buffer.from(data, 'base64url').toString('utf-8');
      }
    } else if (payload.mimeType === 'text/html') {
      const data = payload.body?.data || '';
      if (data) {
        const html = Buffer.from(data, 'base64url').toString('utf-8');
        body = convert(html, { wordwrap: false });
      }
    } else if (payload.parts) {
      for (const part of payload.parts) {
        if (part.mimeType === 'text/plain' && part.body?.data) {
          body = Buffer.from(part.body.data, 'base64url').toString('utf-8');
          break;
        }
      }

      if (!body) {
        for (const part of payload.parts) {
          if (part.mimeType === 'text/html' && part.body?.data) {
            const html = Buffer.from(part.body.data, 'base64url').toString(
              'utf-8',
            );
            body = convert(html, { wordwrap: false });
            break;
          }
        }
      }
    }

    const lines = body.split('\n').filter((line) => !line.startsWith('>'));
    return lines.join('\n').trim().substring(0, 5000);
  }

  private extractHeader(
    headers: ContactEvaluationHeader[] | undefined,
    name: string,
  ): string {
    if (!headers) return '';
    const header = headers.find(
      (h) => h.name?.toLowerCase() === name.toLowerCase(),
    );
    return header?.value || '';
  }

  private normalizeHeaders(
    headers: gmail_v1.Schema$MessagePartHeader[] | undefined,
  ): ContactEvaluationHeader[] {
    if (!headers) return [];

    return headers.flatMap((header) => {
      if (!header.name || !header.value) {
        return [];
      }

      return [{ name: header.name, value: header.value }];
    });
  }

  private filterRelevantHeaders(
    headers: ContactEvaluationHeader[],
  ): ContactEvaluationHeader[] {
    return headers.filter((header) => {
      const name = header.name.toLowerCase();
      return (
        name === 'list-unsubscribe' || name === 'list-id' || name === 'x-mailer'
      );
    });
  }

  private buildMessageHeaderLookup(
    messages: gmail_v1.Schema$Message[],
  ): Map<string, ContactEvaluationHeader[]> {
    const lookup = new Map<string, ContactEvaluationHeader[]>();

    for (const message of messages) {
      if (!message.id) continue;

      const headers = this.filterRelevantHeaders(
        this.normalizeHeaders(message.payload?.headers),
      );

      if (headers.length > 0) {
        lookup.set(message.id, headers);
      }
    }

    return lookup;
  }

  private parseEmailAddress(raw: string): ParsedAddress {
    const match = raw.match(/^(.+?)\s*<(.+?)>$/);
    if (match) {
      return {
        name: match[1].replace(/"/g, '').trim(),
        email: match[2].trim().toLowerCase(),
      };
    }

    return { name: '', email: raw.trim().toLowerCase() };
  }

  private parseAddressList(raw: string): ParsedAddress[] {
    if (!raw) return [];
    return raw
      .split(',')
      .map((addr) => this.parseEmailAddress(addr.trim()))
      .filter((addr) => !!addr.email);
  }

  private round(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private average(values: number[]): number | null {
    if (values.length === 0) return null;
    const total = values.reduce((sum, value) => sum + value, 0);
    return this.round(total / values.length);
  }

  private isWithinDays(date: Date, days: number, now: Date): boolean {
    return now.getTime() - date.getTime() <= days * 24 * 60 * 60 * 1000;
  }

  private toDayKey(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  private buildParticipants(parsed: ParsedMessage): Array<{
    role: ParticipantRole;
    email: string;
    name: string | null;
  }> {
    const participants: Array<{
      role: ParticipantRole;
      email: string;
      name: string | null;
    }> = [];
    const seen = new Set<string>();

    const pushParticipant = (
      role: ParticipantRole,
      address: ParsedAddress | undefined,
    ) => {
      if (!address?.email) return;
      const key = `${role}:${address.email}`;
      if (seen.has(key)) return;
      seen.add(key);
      participants.push({
        role,
        email: address.email,
        name: address.name || null,
      });
    };

    pushParticipant(ParticipantRole.from, parsed.from);
    for (const address of parsed.to)
      pushParticipant(ParticipantRole.to, address);
    for (const address of parsed.cc)
      pushParticipant(ParticipantRole.cc, address);
    for (const address of parsed.bcc)
      pushParticipant(ParticipantRole.bcc, address);

    return participants;
  }

  private parseMessage(
    msg: gmail_v1.Schema$Message,
    userEmail: string,
  ): ParsedMessage | null {
    if (!msg.id || !msg.threadId) return null;

    const headers = this.normalizeHeaders(msg.payload?.headers);
    const from = this.parseEmailAddress(this.extractHeader(headers, 'from'));
    const to = this.parseAddressList(this.extractHeader(headers, 'to'));
    const cc = this.parseAddressList(this.extractHeader(headers, 'cc'));
    const bcc = this.parseAddressList(this.extractHeader(headers, 'bcc'));
    const internalDate = parseInt(msg.internalDate || '0', 10);
    const sentAt =
      Number.isFinite(internalDate) && internalDate > 0
        ? new Date(internalDate)
        : new Date();

    return {
      gmailMessageId: msg.id,
      gmailThreadId: msg.threadId,
      subject: this.extractHeader(headers, 'subject'),
      body: this.parseEmailBody(msg.payload || {}),
      snippet: msg.snippet || '',
      headers: this.filterRelevantHeaders(headers),
      from,
      to,
      cc,
      bcc,
      sentAt,
      direction:
        from.email && from.email === userEmail
          ? MessageDirection.outbound
          : MessageDirection.inbound,
      inReplyTo: this.extractHeader(headers, 'in-reply-to') || undefined,
    };
  }

  async fullGmailSync(
    userId: string,
  ): Promise<{ contactsFound: number; threadsStored: number }> {
    const gmail = await this.googleOAuth.getGmailClient(userId);
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const afterTimestamp = Math.floor(sixMonthsAgo.getTime() / 1000);

    const allMessageIds: string[] = [];
    let pageToken: string | undefined;

    do {
      const result = await gmail.users.messages.list({
        userId: 'me',
        q: `after:${afterTimestamp}`,
        maxResults: 500,
        pageToken,
      });
      const messages = result.data.messages || [];
      allMessageIds.push(
        ...messages.map((message) => message.id!).filter(Boolean),
      );
      pageToken = result.data.nextPageToken || undefined;
    } while (pageToken);

    this.logger.log(
      `User ${userId}: found ${allMessageIds.length} messages to process`,
    );

    const allMessages: gmail_v1.Schema$Message[] = [];
    for (let i = 0; i < allMessageIds.length; i += 50) {
      const batchIds = allMessageIds.slice(i, i + 50);
      const batchResults = await Promise.allSettled(
        batchIds.map((id) =>
          gmail.users.messages.get({ userId: 'me', id, format: 'full' }),
        ),
      );

      for (const result of batchResults) {
        if (result.status === 'fulfilled' && result.value.data) {
          allMessages.push(result.value.data);
        }
      }
    }

    await this.persistMessages(user, allMessages);
    const stats = await this.rebuildRelationshipState(
      user,
      this.buildMessageHeaderLookup(allMessages),
    );

    const profile = await gmail.users.getProfile({ userId: 'me' });
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        syncCursor: profile.data.historyId || undefined,
        lastSyncAt: new Date(),
      },
    });

    await this.warmthService.computeWarmthScores(userId);
    await this.pipelineService.detectSignalsAndProgress(userId);

    return stats;
  }

  async incrementalGmailSync(
    userId: string,
  ): Promise<{ contactsFound: number; threadsStored: number }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user?.syncCursor) {
      return this.fullGmailSync(userId);
    }

    const gmail = await this.googleOAuth.getGmailClient(userId);

    try {
      const history = await gmail.users.history.list({
        userId: 'me',
        startHistoryId: user.syncCursor,
        historyTypes: ['messageAdded'],
      });

      const messageIds = new Set<string>();
      for (const record of history.data.history || []) {
        for (const message of record.messagesAdded || []) {
          if (message.message?.id) {
            messageIds.add(message.message.id);
          }
        }
      }

      await this.prisma.user.update({
        where: { id: userId },
        data: {
          syncCursor: history.data.historyId || user.syncCursor,
          lastSyncAt: new Date(),
        },
      });

      if (messageIds.size === 0) {
        return { contactsFound: 0, threadsStored: 0 };
      }

      const messages: gmail_v1.Schema$Message[] = [];
      const results = await Promise.allSettled(
        [...messageIds].map((id) =>
          gmail.users.messages.get({ userId: 'me', id, format: 'full' }),
        ),
      );

      for (const result of results) {
        if (result.status === 'fulfilled' && result.value.data) {
          messages.push(result.value.data);
        }
      }

      await this.persistMessages(user, messages);
      const stats = await this.rebuildRelationshipState(
        user,
        this.buildMessageHeaderLookup(messages),
      );

      await this.warmthService.computeWarmthScores(userId);
      await this.pipelineService.detectSignalsAndProgress(userId);
      return stats;
    } catch {
      this.logger.warn(
        `historyId expired for user ${userId}, triggering full sync`,
      );
      return this.fullGmailSync(userId);
    }
  }

  private async persistMessages(
    user: { id: string; email: string },
    messages: gmail_v1.Schema$Message[],
  ): Promise<number> {
    const userEmail = user.email.toLowerCase();
    let messagesStored = 0;

    for (const msg of messages) {
      const parsed = this.parseMessage(msg, userEmail);
      if (!parsed) continue;

      // Sanitize all text fields before persisting — prevents Postgres
      // 'unexpected end of hex escape' from malformed email content
      const safeBody = this.sanitizeText(parsed.body);
      const safeSnippet = this.sanitizeText(parsed.snippet);
      const safeSubject = parsed.subject ? this.sanitizeText(parsed.subject) : null;

      const persistedMessage = await this.prisma.emailMessage.upsert({
        where: {
          uq_user_message: {
            userId: user.id,
            gmailMessageId: parsed.gmailMessageId,
          },
        },
        create: {
          userId: user.id,
          gmailMessageId: parsed.gmailMessageId,
          gmailThreadId: parsed.gmailThreadId,
          subject: safeSubject,
          snippet: safeSnippet || safeBody.substring(0, 200),
          bodyText: safeBody,
          fromEmail: parsed.from.email,
          direction: parsed.direction,
          inReplyTo: parsed.inReplyTo,
          sentAt: parsed.sentAt,
        },
        update: {
          gmailThreadId: parsed.gmailThreadId,
          subject: safeSubject,
          snippet: safeSnippet || safeBody.substring(0, 200),
          bodyText: safeBody,
          fromEmail: parsed.from.email,
          direction: parsed.direction,
          inReplyTo: parsed.inReplyTo,
          sentAt: parsed.sentAt,
        },
      });

      await this.prisma.emailMessageParticipant.deleteMany({
        where: { messageId: persistedMessage.id },
      });

      const participants = this.buildParticipants(parsed);
      if (participants.length > 0) {
        await this.prisma.emailMessageParticipant.createMany({
          data: participants.map((participant) => ({
            userId: user.id,
            messageId: persistedMessage.id,
            role: participant.role,
            email: participant.email,
            name: participant.name,
          })),
        });
      }

      messagesStored++;
    }

    return messagesStored;
  }

  private ensureAggregate(
    contactData: Map<string, ContactAggregate>,
    email: string,
  ): ContactAggregate {
    if (!contactData.has(email)) {
      contactData.set(email, {
        name: '',
        firstContactedAt: null,
        lastContactedAt: null,
        totalEmails: 0,
        inboundCount: 0,
        outboundCount: 0,
        threadIds: new Set<string>(),
        messagesLast30d: 0,
        messagesLast90d: 0,
        messagesLast180d: 0,
        conversationDays30d: new Set<string>(),
        conversationDays90d: new Set<string>(),
        conversationDays180d: new Set<string>(),
        replyAll: {
          outboundAttempts: 0,
          repliedAttempts: 0,
          responseHours: [],
        },
        reply30d: {
          outboundAttempts: 0,
          repliedAttempts: 0,
          responseHours: [],
        },
        reply90d: {
          outboundAttempts: 0,
          repliedAttempts: 0,
          responseHours: [],
        },
        reply180d: {
          outboundAttempts: 0,
          repliedAttempts: 0,
          responseHours: [],
        },
        lastInboundAt: null,
        lastOutboundAt: null,
        userHasSent: false,
        contactHasReplied: false,
        relevantHeaders: [],
      });
    }

    return contactData.get(email)!;
  }

  private bumpDiscoveryStats(
    aggregate: ContactAggregate,
    threadId: string,
    sentAt: Date,
    now: Date,
  ): void {
    aggregate.totalEmails += 1;
    aggregate.threadIds.add(threadId);

    if (!aggregate.firstContactedAt || sentAt < aggregate.firstContactedAt) {
      aggregate.firstContactedAt = sentAt;
    }
    if (!aggregate.lastContactedAt || sentAt > aggregate.lastContactedAt) {
      aggregate.lastContactedAt = sentAt;
    }

    const dayKey = this.toDayKey(sentAt);
    if (this.isWithinDays(sentAt, 30, now)) {
      aggregate.messagesLast30d += 1;
      aggregate.conversationDays30d.add(dayKey);
    }
    if (this.isWithinDays(sentAt, 90, now)) {
      aggregate.messagesLast90d += 1;
      aggregate.conversationDays90d.add(dayKey);
    }
    if (this.isWithinDays(sentAt, 180, now)) {
      aggregate.messagesLast180d += 1;
      aggregate.conversationDays180d.add(dayKey);
    }
  }

  private addOutboundAttempt(
    aggregate: ContactAggregate,
    sentAt: Date,
    now: Date,
  ): void {
    aggregate.userHasSent = true;
    aggregate.outboundCount += 1;
    aggregate.replyAll.outboundAttempts += 1;

    if (this.isWithinDays(sentAt, 30, now)) {
      aggregate.reply30d.outboundAttempts += 1;
    }
    if (this.isWithinDays(sentAt, 90, now)) {
      aggregate.reply90d.outboundAttempts += 1;
    }
    if (this.isWithinDays(sentAt, 180, now)) {
      aggregate.reply180d.outboundAttempts += 1;
    }

    if (!aggregate.lastOutboundAt || sentAt > aggregate.lastOutboundAt) {
      aggregate.lastOutboundAt = sentAt;
    }
  }

  private addInboundMessage(aggregate: ContactAggregate, sentAt: Date): void {
    aggregate.inboundCount += 1;
    if (!aggregate.lastInboundAt || sentAt > aggregate.lastInboundAt) {
      aggregate.lastInboundAt = sentAt;
    }
  }

  private addReply(
    aggregate: ContactAggregate,
    outboundAt: Date,
    inboundAt: Date,
    now: Date,
  ): void {
    aggregate.contactHasReplied = true;
    const responseHours =
      (inboundAt.getTime() - outboundAt.getTime()) / (1000 * 60 * 60);

    aggregate.replyAll.repliedAttempts += 1;
    aggregate.replyAll.responseHours.push(responseHours);

    if (this.isWithinDays(outboundAt, 30, now)) {
      aggregate.reply30d.repliedAttempts += 1;
      aggregate.reply30d.responseHours.push(responseHours);
    }
    if (this.isWithinDays(outboundAt, 90, now)) {
      aggregate.reply90d.repliedAttempts += 1;
      aggregate.reply90d.responseHours.push(responseHours);
    }
    if (this.isWithinDays(outboundAt, 180, now)) {
      aggregate.reply180d.repliedAttempts += 1;
      aggregate.reply180d.responseHours.push(responseHours);
    }
  }

  private async rebuildRelationshipState(
    user: {
      id: string;
      email: string;
    },
    messageHeadersById: Map<string, ContactEvaluationHeader[]> = new Map(),
  ): Promise<{ contactsFound: number; threadsStored: number }> {
    const userEmail = user.email.toLowerCase();
    const now = new Date();

    const messages = await this.prisma.emailMessage.findMany({
      where: { userId: user.id },
      include: { participants: true },
      orderBy: [{ sentAt: 'asc' }, { createdAt: 'asc' }],
    });
    const existingContacts = await this.prisma.contact.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        email: true,
        isManual: true,
        inclusionStatus: true,
        exclusionReason: true,
      },
    });
    const existingContactsByEmail = new Map(
      existingContacts.map((contact) => [contact.email.toLowerCase(), contact]),
    );

    const contactData = new Map<string, ContactAggregate>();
    const pendingOutbound = new Map<string, Map<string, Date[]>>();
    const threadRecipientCounts = new Map<string, Set<string>>();

    for (const message of messages) {
      const sentAt = message.sentAt || message.createdAt;
      const discoveryParticipants = new Map<string, string>();
      const relevantHeaders =
        messageHeadersById.get(message.gmailMessageId) || [];

      if (!threadRecipientCounts.has(message.gmailThreadId)) {
        threadRecipientCounts.set(message.gmailThreadId, new Set<string>());
      }

      const threadRecipients = threadRecipientCounts.get(
        message.gmailThreadId,
      )!;

      for (const participant of message.participants) {
        const email = participant.email.toLowerCase();
        if (!email) {
          continue;
        }

        if (
          participant.role === ParticipantRole.to ||
          participant.role === ParticipantRole.cc
        ) {
          threadRecipients.add(email);
        }

        if (email === userEmail) {
          continue;
        }
        if (!discoveryParticipants.has(email)) {
          discoveryParticipants.set(email, participant.name || '');
        }
      }

      for (const [email, name] of discoveryParticipants) {
        const aggregate = this.ensureAggregate(contactData, email);
        if (name && !aggregate.name) {
          aggregate.name = name;
        }
        if (relevantHeaders.length > 0) {
          aggregate.relevantHeaders.push(...relevantHeaders);
        }
        this.bumpDiscoveryStats(aggregate, message.gmailThreadId, sentAt, now);
      }

      if (message.direction === MessageDirection.outbound) {
        const outboundRecipients = new Set<string>();

        for (const participant of message.participants) {
          if (
            participant.role !== ParticipantRole.to &&
            participant.role !== ParticipantRole.cc
          ) {
            continue;
          }
          const email = participant.email.toLowerCase();
          if (!email || email === userEmail) {
            continue;
          }
          outboundRecipients.add(email);
        }

        for (const email of outboundRecipients) {
          const aggregate = this.ensureAggregate(contactData, email);
          this.addOutboundAttempt(aggregate, sentAt, now);

          if (!pendingOutbound.has(email)) {
            pendingOutbound.set(email, new Map<string, Date[]>());
          }

          const byThread = pendingOutbound.get(email)!;
          const pendingForThread = byThread.get(message.gmailThreadId) || [];
          pendingForThread.push(sentAt);
          byThread.set(message.gmailThreadId, pendingForThread);
        }
      } else {
        const senderEmail = message.fromEmail.toLowerCase();
        if (senderEmail && senderEmail !== userEmail) {
          const aggregate = this.ensureAggregate(contactData, senderEmail);
          this.addInboundMessage(aggregate, sentAt);

          const byThread = pendingOutbound.get(senderEmail);
          const pendingForThread = byThread?.get(message.gmailThreadId);
          const outboundAt = pendingForThread?.shift();

          if (outboundAt) {
            this.addReply(aggregate, outboundAt, sentAt, now);
          }
        }
      }
    }

    const contactIdsByEmail = new Map<string, string>();
    let activeOrPendingContacts = 0;
    for (const [email, aggregate] of contactData) {
      const existingContact = existingContactsByEmail.get(email);
      const maxThreadParticipantCount = Math.max(
        ...[...aggregate.threadIds].map(
          (threadId) => threadRecipientCounts.get(threadId)?.size ?? 0,
        ),
        0,
      );
      let evaluation = evaluateContact({
        email,
        userEmail,
        headers: aggregate.relevantHeaders,
        threadParticipantCount: maxThreadParticipantCount,
        userHasSent: aggregate.userHasSent,
        contactHasReplied: aggregate.contactHasReplied,
      });

      if (
        !existingContact?.isManual &&
        existingContact?.exclusionReason === 'list_email' &&
        evaluation.status !== 'excluded'
      ) {
        evaluation = {
          include: false,
          status: 'excluded',
          reason: 'list_email',
        };
      }

      const finalStatus: ContactInclusionStatus = existingContact?.isManual
        ? (existingContact.inclusionStatus as ContactInclusionStatus)
        : evaluation.status;
      const finalReason: ContactExclusionReason | null =
        existingContact?.isManual
          ? (existingContact.exclusionReason as ContactExclusionReason | null)
          : finalStatus === 'active'
            ? null
            : (evaluation.reason as ContactExclusionReason);
      const totalThreads = Math.max(aggregate.threadIds.size, 1);
      const replyRate =
        aggregate.replyAll.outboundAttempts > 0
          ? aggregate.replyAll.repliedAttempts /
            aggregate.replyAll.outboundAttempts
          : 0;
      const replyRate30d =
        aggregate.reply30d.outboundAttempts > 0
          ? aggregate.reply30d.repliedAttempts /
            aggregate.reply30d.outboundAttempts
          : 0;
      const replyRate90d =
        aggregate.reply90d.outboundAttempts > 0
          ? aggregate.reply90d.repliedAttempts /
            aggregate.reply90d.outboundAttempts
          : 0;
      const replyRate180d =
        aggregate.reply180d.outboundAttempts > 0
          ? aggregate.reply180d.repliedAttempts /
            aggregate.reply180d.outboundAttempts
          : 0;

      const contact = await this.prisma.contact.upsert({
        where: {
          uq_user_contact_email: { userId: user.id, email },
        },
        create: {
          userId: user.id,
          email,
          name: aggregate.name || null,
          isManual: false,
          firstContactedAt: aggregate.firstContactedAt,
          lastContactedAt: aggregate.lastContactedAt,
          totalEmails: aggregate.totalEmails,
          inboundCount: aggregate.inboundCount,
          outboundCount: aggregate.outboundCount,
          replyRate: this.round(replyRate),
          avgThreadDepth: this.round(aggregate.totalEmails / totalThreads),
          replyRate30d: this.round(replyRate30d),
          replyRate90d: this.round(replyRate90d),
          replyRate180d: this.round(replyRate180d),
          avgResponseHours30d: this.average(aggregate.reply30d.responseHours),
          avgResponseHours90d: this.average(aggregate.reply90d.responseHours),
          avgResponseHours180d: this.average(aggregate.reply180d.responseHours),
          messagesLast30d: aggregate.messagesLast30d,
          messagesLast90d: aggregate.messagesLast90d,
          messagesLast180d: aggregate.messagesLast180d,
          conversationDays30d: aggregate.conversationDays30d.size,
          conversationDays90d: aggregate.conversationDays90d.size,
          conversationDays180d: aggregate.conversationDays180d.size,
          lastInboundAt: aggregate.lastInboundAt,
          lastOutboundAt: aggregate.lastOutboundAt,
          inclusionStatus: finalStatus,
          exclusionReason: finalReason,
        },
        update: {
          name: aggregate.name || undefined,
          firstContactedAt: aggregate.firstContactedAt,
          lastContactedAt: aggregate.lastContactedAt,
          totalEmails: aggregate.totalEmails,
          inboundCount: aggregate.inboundCount,
          outboundCount: aggregate.outboundCount,
          replyRate: this.round(replyRate),
          avgThreadDepth: this.round(aggregate.totalEmails / totalThreads),
          replyRate30d: this.round(replyRate30d),
          replyRate90d: this.round(replyRate90d),
          replyRate180d: this.round(replyRate180d),
          avgResponseHours30d: this.average(aggregate.reply30d.responseHours),
          avgResponseHours90d: this.average(aggregate.reply90d.responseHours),
          avgResponseHours180d: this.average(aggregate.reply180d.responseHours),
          messagesLast30d: aggregate.messagesLast30d,
          messagesLast90d: aggregate.messagesLast90d,
          messagesLast180d: aggregate.messagesLast180d,
          conversationDays30d: aggregate.conversationDays30d.size,
          conversationDays90d: aggregate.conversationDays90d.size,
          conversationDays180d: aggregate.conversationDays180d.size,
          lastInboundAt: aggregate.lastInboundAt,
          lastOutboundAt: aggregate.lastOutboundAt,
          inclusionStatus: finalStatus,
          exclusionReason: finalReason,
        },
      });

      if (finalStatus !== 'excluded') {
        contactIdsByEmail.set(email, contact.id);
        activeOrPendingContacts++;
      }
    }

    const missingAutoContacts = await this.prisma.contact.findMany({
      where: {
        userId: user.id,
        isManual: false,
        email: {
          notIn: [...contactData.keys()],
        },
      },
      select: { id: true },
    });

    if (missingAutoContacts.length > 0) {
      await this.prisma.contact.updateMany({
        where: {
          id: { in: missingAutoContacts.map((contact) => contact.id) },
        },
        data: {
          firstContactedAt: null,
          lastContactedAt: null,
          totalEmails: 0,
          inboundCount: 0,
          outboundCount: 0,
          replyRate: 0,
          avgThreadDepth: 0,
          replyRate30d: 0,
          replyRate90d: 0,
          replyRate180d: 0,
          avgResponseHours30d: null,
          avgResponseHours90d: null,
          avgResponseHours180d: null,
          messagesLast30d: 0,
          messagesLast90d: 0,
          messagesLast180d: 0,
          conversationDays30d: 0,
          conversationDays90d: 0,
          conversationDays180d: 0,
          lastInboundAt: null,
          lastOutboundAt: null,
        },
      });
    }

    const threadsStored = await this.rebuildThreadsFromHistory(
      user.id,
      userEmail,
      messages,
      contactIdsByEmail,
    );

    return {
      contactsFound: activeOrPendingContacts,
      threadsStored,
    };
  }

  // ─── Sequence Engine: Send & Reply Detection ──────────────────────────────

  /**
   * Send an email via Gmail API on behalf of a user.
   * Returns the Gmail messageId and threadId for tracking.
   */
  async sendEmail(
    userId: string,
    to: string,
    subject: string,
    body: string,
    replyToMessageId?: string,
  ): Promise<{ messageId: string; threadId: string }> {
    const gmail = await this.googleOAuth.getGmailClient(userId);
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });

    // Build MIME message
    const headers = [
      `From: ${user.name || user.email} <${user.email}>`,
      `To: ${to}`,
      `Subject: ${subject}`,
      `MIME-Version: 1.0`,
      `Content-Type: text/html; charset=UTF-8`,
    ];

    if (replyToMessageId) {
      headers.push(`In-Reply-To: ${replyToMessageId}`);
      headers.push(`References: ${replyToMessageId}`);
    }

    // Convert newlines in body to HTML <br> tags for email rendering
    const htmlBody = body
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>');

    const rawMessage = [...headers, '', htmlBody].join('\r\n');
    const encodedMessage = Buffer.from(rawMessage)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    try {
      const result = await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedMessage,
        },
      });

      this.logger.log(
        `Sent email to ${to} for user ${userId}, messageId: ${result.data.id}`,
      );

      return {
        messageId: result.data.id || '',
        threadId: result.data.threadId || '',
      };
    } catch (err: any) {
      this.logger.error(
        `Failed to send email to ${to} for user ${userId}: ${err.message}`,
      );
      throw err;
    }
  }

  /**
   * Check if there are inbound replies in the thread containing a sent message.
   * Returns true if a reply was detected after the sent message.
   */
  async checkForReplies(
    userId: string,
    gmailMessageId: string,
    sentAt: Date,
  ): Promise<{ hasReply: boolean; replyAt?: Date }> {
    try {
      const gmail = await this.googleOAuth.getGmailClient(userId);
      const user = await this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
      });
      const userEmail = user.email.toLowerCase();

      // Get the original message to find its thread
      const originalMessage = await gmail.users.messages.get({
        userId: 'me',
        id: gmailMessageId,
        format: 'metadata',
        metadataHeaders: ['From'],
      });

      const threadId = originalMessage.data.threadId;
      if (!threadId) return { hasReply: false };

      // Get all messages in the thread
      const thread = await gmail.users.threads.get({
        userId: 'me',
        id: threadId,
        format: 'metadata',
        metadataHeaders: ['From'],
      });

      const messages = thread.data.messages || [];

      // Look for inbound messages after our sent message
      for (const msg of messages) {
        if (msg.id === gmailMessageId) continue;

        const internalDate = parseInt(msg.internalDate || '0', 10);
        if (!Number.isFinite(internalDate) || internalDate <= 0) continue;

        const msgDate = new Date(internalDate);
        if (msgDate <= sentAt) continue;

        // Check if from someone other than the user (inbound)
        const fromHeader = msg.payload?.headers?.find(
          (h) => h.name?.toLowerCase() === 'from',
        );
        const fromEmail = this.parseEmailAddress(fromHeader?.value || '').email;

        if (fromEmail && fromEmail !== userEmail) {
          return { hasReply: true, replyAt: msgDate };
        }
      }

      return { hasReply: false };
    } catch (err: any) {
      this.logger.error(
        `Failed to check replies for message ${gmailMessageId}: ${err.message}`,
      );
      return { hasReply: false };
    }
  }

  private async rebuildThreadsFromHistory(
    userId: string,
    userEmail: string,
    messages: Array<EmailMessage & { participants: EmailMessageParticipant[] }>,
    contactIdsByEmail: Map<string, string>,
  ): Promise<number> {
    const threadData = new Map<string, ThreadAggregate>();

    for (const message of messages) {
      const timestamp = message.sentAt || message.createdAt;
      const externalParticipants = [
        ...new Set(
          message.participants
            .map((participant) => participant.email.toLowerCase())
            .filter((email) => !!email && email !== userEmail),
        ),
      ];

      if (!threadData.has(message.gmailThreadId)) {
        threadData.set(message.gmailThreadId, {
          subject: message.subject || '',
          messages: [],
          lastMessageAt: timestamp,
        });
      }

      const thread = threadData.get(message.gmailThreadId)!;
      if (!thread.subject && message.subject) {
        thread.subject = message.subject;
      }

      thread.messages.push({
        timestamp,
        fromEmail: message.fromEmail.toLowerCase(),
        body: message.bodyText || '',
        snippet: message.snippet || '',
        externalParticipants,
      });

      if (timestamp > thread.lastMessageAt) {
        thread.lastMessageAt = timestamp;
      }
    }

    const threadIds = [...threadData.keys()];
    if (threadIds.length === 0) {
      await this.prisma.emailThread.deleteMany({ where: { userId } });
      return 0;
    }

    await this.prisma.emailThread.deleteMany({
      where: {
        userId,
        gmailThreadId: { notIn: threadIds },
      },
    });

    let threadsStored = 0;
    for (const [gmailThreadId, thread] of threadData) {
      thread.messages.sort(
        (left, right) => left.timestamp.getTime() - right.timestamp.getTime(),
      );

      const primaryEmail =
        thread.messages.find(
          (message) =>
            message.fromEmail !== userEmail &&
            contactIdsByEmail.has(message.fromEmail),
        )?.fromEmail ||
        thread.messages
          .flatMap((message) => message.externalParticipants)
          .find((email) => contactIdsByEmail.has(email));

      if (!primaryEmail) continue;

      const contactId = contactIdsByEmail.get(primaryEmail);
      if (!contactId) continue;

      const fullContent = thread.messages
        .map(
          (message) =>
            `[${message.timestamp.toISOString()}] ${message.fromEmail}:\n${message.body}`,
        )
        .join('\n\n---\n\n')
        .substring(0, 5000);

      const lastMessage = thread.messages[thread.messages.length - 1];

      await this.prisma.emailThread.upsert({
        where: {
          uq_user_thread: { userId, gmailThreadId },
        },
        create: {
          userId,
          contactId,
          gmailThreadId,
          subject: thread.subject || null,
          messageCount: thread.messages.length,
          lastMessageAt: thread.lastMessageAt,
          snippet:
            lastMessage.snippet || lastMessage.body.substring(0, 200) || null,
          fullContent,
        },
        update: {
          contactId,
          subject: thread.subject || null,
          messageCount: thread.messages.length,
          lastMessageAt: thread.lastMessageAt,
          snippet:
            lastMessage.snippet || lastMessage.body.substring(0, 200) || null,
          fullContent,
        },
      });

      threadsStored++;
    }

    return threadsStored;
  }
}
