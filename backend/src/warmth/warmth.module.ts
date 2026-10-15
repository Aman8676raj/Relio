import { Module } from '@nestjs/common';
import { WarmthService } from './warmth.service';

@Module({
  providers: [WarmthService],
  exports: [WarmthService],
})
export class WarmthModule {}
