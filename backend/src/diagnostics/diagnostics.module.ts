import { Module } from '@nestjs/common';
import { DiagnosticsService } from './diagnostics.service';
import { DiagnosticsController } from './diagnostics.controller';
import { PrismaModule } from '../prisma';

@Module({
  imports: [PrismaModule],
  providers: [DiagnosticsService],
  controllers: [DiagnosticsController],
  exports: [DiagnosticsService],
})
export class DiagnosticsModule {}
