import { Module } from '@nestjs/common';
import { ForecastingService } from './forecasting.service';
import { ForecastingController } from './forecasting.controller';
import { PrismaModule } from '../prisma';

@Module({
  imports: [PrismaModule],
  providers: [ForecastingService],
  controllers: [ForecastingController],
  exports: [ForecastingService],
})
export class ForecastingModule {}
