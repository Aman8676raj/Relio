import { Controller, Get, Patch, Post, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { MeetingsService } from './meetings.service';
import type { User } from '@prisma/client';
import { PrismaService } from '../prisma';

@ApiTags('meetings')
@Controller('api/meetings')
@Roles() // any authenticated org member
export class MeetingsController {
  constructor(
    private readonly meetingsService: MeetingsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('briefs')
  @ApiOperation({ summary: 'Get all meeting briefs for current user' })
  async getBriefs(@CurrentUser() user: User) {
    return this.meetingsService.getBriefs(user.id);
  }

  @Patch('briefs/:id/viewed')
  @ApiOperation({ summary: 'Mark a meeting brief as viewed' })
  async markViewed(@Param('id') id: string, @CurrentUser() user: User) {
    await this.meetingsService.markViewed(id, user.id);
    return { success: true };
  }

  @Post('sync')
  @Roles('owner', 'contributor')
  @ApiOperation({ summary: 'Sync Google Calendar and generate briefs for upcoming meetings' })
  async syncCalendar(@CurrentUser() user: User) {
    // Fetch the user's Google tokens from DB (not on JWT payload)
    const fullUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, googleAccessToken: true, googleRefreshToken: true },
    });

    if (!fullUser) return { success: false, reason: 'User not found' };

    await this.meetingsService.syncCalendarAndGenerateBriefs(fullUser);
    return { success: true };
  }
}
