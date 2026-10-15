import { Controller, Get, Post } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { DiagnosticsService } from './diagnostics.service';
import type { User } from '@prisma/client';

@ApiTags('diagnostics')
@Controller('api/diagnostics')
@Roles() // any authenticated org member
export class DiagnosticsController {
  constructor(private readonly diagnosticsService: DiagnosticsService) {}

  @Get('latest')
  @ApiOperation({ summary: 'Get the most recent diagnostics report' })
  async getLatest(@CurrentUser() user: User) {
    return this.diagnosticsService.getLatestReport(user.id);
  }

  @Post('generate')
  @Roles('owner', 'contributor')
  @ApiOperation({ summary: 'Generate a new weekly diagnostics report' })
  async generate(@CurrentUser() user: User) {
    return this.diagnosticsService.generateWeeklyReport(user.id);
  }
}
