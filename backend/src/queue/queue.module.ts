import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { GmailSyncProcessor } from './gmail-sync.processor';
import { DigestProcessor } from './digest.processor';
import { SequenceSendProcessor } from './sequence-send.processor';
import { SequenceReplyProcessor } from './sequence-reply.processor';
import { SyncController } from './sync.controller';
import { QueueSchedulerService } from './queue-scheduler.service';
import { GmailModule } from '../gmail/gmail.module';
import { DigestModule } from '../digest/digest.module';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: 'gmail-sync' },
      { name: 'morning-digest' },
      { name: 'sequence-send' },
      { name: 'sequence-reply' },
    ),
    GmailModule,
    DigestModule,
  ],
  controllers: [SyncController],
  providers: [
    GmailSyncProcessor,
    DigestProcessor,
    SequenceSendProcessor,
    SequenceReplyProcessor,
    QueueSchedulerService,
  ],
  exports: [BullModule],
})
export class QueueModule {}
