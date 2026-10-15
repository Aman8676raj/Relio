import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { ForecastingService } from './forecasting.service';
import type { User } from '@prisma/client';

@ApiTags('forecast')
@Controller('api/forecast')
@Roles() // any authenticated org member
export class ForecastingController {
  constructor(private readonly forecastingService: ForecastingService) {}

  @Get('current')
  @ApiOperation({ summary: 'Get current forecast (cached for today)' })
  async getCurrentForecast(@CurrentUser() user: User) {
    return this.forecastingService.getCurrentForecast(user.id);
  }

  @Get('recalculate')
  @Roles('owner', 'contributor')
  @ApiOperation({ summary: 'Force recalculate forecast snapshot' })
  async recalculate(@CurrentUser() user: User) {
    return this.forecastingService.calculateAndSaveForecast(user.id);
  }
}
