import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { DashboardService } from './dashboard.service';
import type { User } from '@prisma/client';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('dashboard')
@Controller('api/dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('pulse')
  @ApiOperation({
    summary: 'Raise momentum score, soft ghosts, tier breakdown, weekly delta',
  })
  async getPulse(@CurrentUser() user: User) {
    return this.dashboardService.getPulse(user.id);
  }

  @Get('actions')
  @ApiOperation({ summary: 'AI-ranked priority actions (3-5)' })
  async getActions(@CurrentUser() user: User) {
    return this.dashboardService.getActions(user.id);
  }

  @Get('report-card')
  @ApiOperation({ summary: 'Get weekly report card' })
  async getReportCard(@CurrentUser() user: User) {
    return this.dashboardService.getReportCard(user.id);
  }

  @Get('heatmap')
  @ApiOperation({ summary: 'Get activity heatmap data' })
  async getHeatmap(@CurrentUser() user: User) {
    return this.dashboardService.getHeatmap(user.id);
  }
}
