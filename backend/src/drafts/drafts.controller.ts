import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Res,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import * as express from 'express';
import { CurrentUser } from '../auth/current-user.decorator';
import { GoogleOAuthService } from '../auth/google-oauth.service';
import { DraftGeneratorService } from './draft-generator.service';
import { PrismaService } from '../prisma';
import { GenerateDraftDto, SendDraftDto, DraftFeedbackDto } from './dto/drafts.dto';
import { DraftFeedback } from '@prisma/client';
import type { User } from '@prisma/client';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('drafts')
@Controller('api/drafts')
export class DraftsController {
  constructor(
    private readonly draftGenerator: DraftGeneratorService,
    private readonly googleOAuth: GoogleOAuthService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List all drafts for the current user' })
  async listDrafts(@CurrentUser() user: User) {
    const drafts = await this.prisma.draft.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      include: { contact: true },
    });

    return {
      data: drafts,
      meta: { total: drafts.length },
    };
  }

  @Post('preview')
  @ApiOperation({ summary: 'Generate a draft preview and save to DB' })
  async generatePreview(
    @CurrentUser() user: User,
    @Body() dto: GenerateDraftDto,
  ) {
    const contact = await this.prisma.contact.findFirst({
      where: { id: dto.contact_id, userId: user.id },
    });
    if (!contact) throw new NotFoundException('Contact not found');

    try {
      const text = await this.draftGenerator.generateDraftSync(
        dto.contact_id,
        user.id,
      );
      const wordCount = text.split(/\s+/).filter(Boolean).length;

      // Save draft to DB so it can be sent via Gmail later
      const draft = await this.prisma.draft.create({
        data: {
          userId: user.id,
          contactId: contact.id,
          generatedText: text,
        },
      });

      return { text, wordCount, contactId: contact.id, draftId: draft.id };
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Draft generation failed';
      return { text: null, error: message };
    }
  }

  @Post()
  @ApiOperation({ summary: 'Start draft generation (SSE stream)' })
  async createDraft(
    @CurrentUser() user: User,
    @Body() dto: GenerateDraftDto,
    @Res() res: express.Response,
  ): Promise<void> {
    const contact = await this.prisma.contact.findFirst({
      where: { id: dto.contact_id, userId: user.id },
    });
    if (!contact) throw new NotFoundException('Contact not found');

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    try {
      for await (const chunk of this.draftGenerator.generateDraftStream(
        dto.contact_id,
        user.id,
      )) {
        res.write(chunk);
      }
    } catch {
      res.write(
        `data: ${JSON.stringify({ type: 'error', content: 'Draft generation failed. Try again.' })}\n\n`,
      );
    } finally {
      res.end();
    }
  }

  @Post(':id/send')
  @ApiOperation({ summary: 'Send draft via Gmail' })
  async sendDraft(
    @CurrentUser() user: User,
    @Param('id') draftId: string,
    @Body() dto: SendDraftDto,
  ) {
    const draft = await this.prisma.draft.findFirst({
      where: { id: draftId, userId: user.id },
    });
    if (!draft) throw new NotFoundException('Draft not found');
    if (draft.wasSent) throw new ConflictException('Draft already sent');

    const contact = await this.prisma.contact.findUniqueOrThrow({
      where: { id: draft.contactId },
    });

    const gmail = await this.googleOAuth.getGmailClient(user.id);

    // Build raw email
    const emailLines = [
      `To: ${contact.email}`,
      `From: ${user.email}`,
      `Subject: ${dto.subject || 'Following up'}`,
      'Content-Type: text/plain; charset=utf-8',
      '',
      dto.text,
    ];
    const raw = Buffer.from(emailLines.join('\r\n')).toString('base64url');

    const result = await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw },
    });

    await this.prisma.draft.update({
      where: { id: draftId },
      data: {
        finalSentText: dto.text,
        editedText: dto.text !== draft.generatedText ? dto.text : undefined,
        wasSent: true,
        gmailMessageId: result.data.id || undefined,
      },
    });

    return { success: true, gmailMessageId: result.data.id };
  }

  @Post(':id/feedback')
  @ApiOperation({ summary: 'Submit draft feedback (thumbs up/down)' })
  async submitFeedback(
    @CurrentUser() user: User,
    @Param('id') draftId: string,
    @Body() dto: DraftFeedbackDto,
  ) {
    const draft = await this.prisma.draft.findFirst({
      where: { id: draftId, userId: user.id },
    });
    if (!draft) throw new NotFoundException('Draft not found');

    await this.prisma.draft.update({
      where: { id: draftId },
      data: { feedback: dto.feedback as DraftFeedback },
    });

    return { success: true };
  }
}
