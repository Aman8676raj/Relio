import {
  Controller, Get, Put, Post, Body, Param, Query,
  NotFoundException,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { DiscoveryService } from './discovery.service';
import { UpdateStartupProfileDto, DiscoverySearchDto } from './dto/discovery.dto';
import { BatchScoreDto } from './dto/batch-score.dto';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('discovery')
@Controller('api/discovery')
export class DiscoveryController {
  constructor(private readonly service: DiscoveryService) {}

  // ─── Startup Profile ────────────────────────────────────────────────────

  @Get('profile')
  @ApiOperation({ summary: 'Get current user startup profile' })
  async getProfile(@CurrentUser() user: { id: string }) {
    const profile = await this.service.getProfile(user.id);
    return profile || { needsSetup: true };
  }

  @Put('profile')
  @ApiOperation({ summary: 'Create or update startup profile' })
  async updateProfile(
    @CurrentUser() user: { id: string },
    @Body() dto: UpdateStartupProfileDto,
  ) {
    return this.service.upsertProfile(user.id, dto);
  }

  // ─── Discovery Search ───────────────────────────────────────────────────

  @Get('search')
  @ApiOperation({ summary: 'Search investors with scoring' })
  async search(
    @CurrentUser() user: { id: string },
    @Query() dto: DiscoverySearchDto,
  ) {
    return this.service.search(user.id, dto);
  }

  // ─── Score a single investor ────────────────────────────────────────────

  @Post('score/:investorId')
  @ApiOperation({ summary: 'Score a specific investor for current user' })
  async scoreInvestor(
    @CurrentUser() user: { id: string },
    @Param('investorId') investorId: string,
  ) {
    const result = await this.service.scoreInvestor(user.id, investorId);
    if (!result) throw new NotFoundException('Investor or profile not found');
    return result;
  }

  // ─── Batch Score ────────────────────────────────────────────────────────

  @Post('score-batch')
  @ApiOperation({ summary: 'Trigger batch scoring of top investors' })
  async batchScore(
    @CurrentUser() user: { id: string },
    @Body() dto: BatchScoreDto,
  ) {
    return this.service.batchScore(user.id, dto.limit || 100);
  }
}
