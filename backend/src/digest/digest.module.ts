import { Module } from '@nestjs/common';
import { DigestService } from './digest.service';
import { DigestController } from './digest.controller';
import { DigestSchedulerService } from './digest-scheduler.service';

@Module({
  controllers: [DigestController],
  providers: [DigestService, DigestSchedulerService],
  exports: [DigestService],
})
export class DigestModule {}
