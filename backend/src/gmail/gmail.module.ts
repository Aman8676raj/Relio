import { Module } from '@nestjs/common';
import { GmailService } from './gmail.service';
import { AuthModule } from '../auth/auth.module';
import { WarmthModule } from '../warmth/warmth.module';
import { PipelineModule } from '../pipeline/pipeline.module';

@Module({
  imports: [AuthModule, WarmthModule, PipelineModule],
  providers: [GmailService],
  exports: [GmailService],
})
export class GmailModule {}
