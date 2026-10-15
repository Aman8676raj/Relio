import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { ApiTags, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { Public } from '../auth/public.decorator';
import { DecksService } from './decks.service';
import { CreateShareDto, TrackPageDto, CompleteViewDto } from './dto/decks.dto';
import type { User } from '@prisma/client';

@ApiTags('decks')
@Controller('api/decks')
export class DecksController {
  constructor(private readonly decksService: DecksService) {}

  @Post('upload')
  @Roles('owner', 'contributor')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload a pitch deck PDF' })
  @ApiConsumes('multipart/form-data')
  async upload(@UploadedFile() file: Express.Multer.File, @CurrentUser() user: User) {
    if (!file) throw new BadRequestException('No file provided');
    return this.decksService.uploadDeck(user.id, file);
  }

  @Get()
  @Roles()
  @ApiOperation({ summary: 'List all decks for current user' })
  async list(@CurrentUser() user: User) {
    return this.decksService.listDecks(user.id);
  }

  @Post(':deckId/share')
  @Roles('owner', 'contributor')
  @ApiOperation({ summary: 'Create a tracked share link for a deck' })
  async createShare(
    @Param('deckId') deckId: string,
    @CurrentUser() user: User,
    @Body() dto: CreateShareDto,
  ) {
    return this.decksService.createShare(user.id, deckId, dto.contactId, dto.expiresInDays);
  }

  @Get(':deckId/analytics')
  @Roles()
  @ApiOperation({ summary: 'Get engagement analytics for a deck' })
  async analytics(@Param('deckId') deckId: string, @CurrentUser() user: User) {
    return this.decksService.getDeckAnalytics(user.id, deckId);
  }

  /** Public viewer — no auth required, tracked by share token */
  @Public()
  @Get('view/:token')
  @ApiOperation({ summary: 'View a shared deck (public, no auth)' })
  async viewDeck(@Param('token') token: string, @Res() res: Response) {
    const deck = await this.decksService.getDeckByToken(token);
    if (!deck) return res.status(404).json({ error: 'Not found or expired' });

    const viewId = await this.decksService.startView(token, res.req?.ip);
    return res.json({ deck, viewId });
  }

  /** Track page view events (called by viewer frontend) */
  @Public()
  @Post('view/:token/page')
  @ApiOperation({ summary: 'Track page view event' })
  async trackPage(
    @Param('token') token: string,
    @Body() dto: TrackPageDto,
  ) {
    await this.decksService.recordPageView(dto.viewId, dto.page, dto.seconds);
    return { ok: true };
  }

  /** Complete a view session */
  @Public()
  @Post('view/:token/complete')
  @ApiOperation({ summary: 'Mark a view session as complete' })
  async completeView(@Param('token') token: string, @Body() dto: CompleteViewDto) {
    await this.decksService.completeView(dto.viewId);
    return { ok: true };
  }
}
