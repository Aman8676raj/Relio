import {
  Controller,
  Get,
  Patch,
  Post,
  Param,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { SentimentService } from './sentiment.service';
import type { User } from '@prisma/client';

@ApiTags('sentiment')
@Controller('api/sentiment')
@Roles() // any authenticated org member
export class SentimentController {
  constructor(private readonly sentimentService: SentimentService) {}

  @Get('alerts')
  @ApiOperation({ summary: 'Get active sentiment alerts' })
  async getAlerts(@CurrentUser() user: User) {
    return this.sentimentService.getAlerts(user.id);
  }

  @Patch('alerts/:id/dismiss')
  @Roles('owner', 'contributor')
  @ApiOperation({ summary: 'Dismiss a sentiment alert' })
  async dismissAlert(@Param('id') id: string, @CurrentUser() user: User) {
    const result = await this.sentimentService.dismissAlert(id, user.id);
    if (result.count === 0) throw new NotFoundException('Alert not found');
    return { success: true };
  }

  @Post('run')
  @Roles('owner', 'contributor')
  @ApiOperation({ summary: 'Run manual sentiment analysis for all pipeline contacts' })
  async runManual(@CurrentUser() user: User) {
    await this.sentimentService.runAnalysisForUser(user.id);
    return { success: true };
  }
}
