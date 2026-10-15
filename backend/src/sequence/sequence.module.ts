import { Module } from '@nestjs/common';
import { SequenceController } from './sequence.controller';
import { SequenceService } from './sequence.service';
import { SequenceGeneratorService } from './sequence-generator.service';

@Module({
  controllers: [SequenceController],
  providers: [SequenceService, SequenceGeneratorService],
  exports: [SequenceService],
})
export class SequenceModule {}
