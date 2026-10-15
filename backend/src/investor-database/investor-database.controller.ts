import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  NotFoundException,
} from '@nestjs/common';
import { InvestorDatabaseService } from './investor-database.service';
import { QueryInvestorsDto } from './dto/query-investors.dto';
import { SeedInvestorsDto } from './dto/seed-investors.dto';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';

@ApiTags('investors')
@SkipThrottle()  // Read-only data browsing — no throttle needed on GETs
@Controller('api/investors')
export class InvestorDatabaseController {
  constructor(private readonly service: InvestorDatabaseService) {}

  @Get()
  @ApiOperation({ summary: 'List investors with filters and search' })
  async list(@Query() query: QueryInvestorsDto) {
    return this.service.findAll(query);
  }

  @Get('filters')
  @ApiOperation({ summary: 'Get available filter options for dropdowns' })
  async getFilters() {
    return this.service.getFilterOptions();
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get investor database statistics' })
  async getStats() {
    return this.service.getStats();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single investor by ID' })
  @ApiParam({ name: 'id', description: 'Investor UUID' })
  async getOne(@Param('id') id: string) {
    const investor = await this.service.findOne(id);
    if (!investor) throw new NotFoundException('Investor not found');
    return investor;
  }

  @Post('seed')
  @SkipThrottle({ default: false })  // re-enable throttle — seed is a heavy write operation
  @ApiOperation({ summary: 'Seed investors from JSON payload' })
  async seed(@Body() dto: SeedInvestorsDto) {
    return this.service.seed(dto.investors);
  }
}
