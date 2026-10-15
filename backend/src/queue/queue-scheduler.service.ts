import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';

@Injectable()
export class QueueSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(QueueSchedulerService.name);

  constructor(
    @InjectQueue('gmail-sync') private readonly gmailQueue: Queue,
    @InjectQueue('morning-digest') private readonly digestQueue: Queue,
    @InjectQueue('sequence-send') private readonly sequenceSendQueue: Queue,
    @InjectQueue('sequence-reply') private readonly sequenceReplyQueue: Queue,
  ) {}

  async onModuleInit(): Promise<void> {
    await Promise.all([
      this.gmailQueue.upsertJobScheduler(
        'gmail-sync-sweep',
        { every: 15 * 60 * 1000 },
        {
          name: 'sync-all',
          data: { mode: 'incremental' },
          opts: {
            removeOnComplete: 100,
            removeOnFail: 100,
          },
        },
      ),
      this.digestQueue.upsertJobScheduler(
        'morning-digest-hourly',
        { every: 60 * 60 * 1000 },
        {
          name: 'process-hour',
          data: {},
          opts: {
            removeOnComplete: 100,
            removeOnFail: 100,
          },
        },
      ),
      this.sequenceSendQueue.upsertJobScheduler(
        'sequence-send-sweep',
        { every: 5 * 60 * 1000 }, // every 5 minutes
        {
          name: 'send-due',
          data: {},
          opts: {
            removeOnComplete: 100,
            removeOnFail: 50,
          },
        },
      ),
      this.sequenceReplyQueue.upsertJobScheduler(
        'sequence-reply-check',
        { every: 15 * 60 * 1000 }, // every 15 minutes
        {
          name: 'check-replies',
          data: {},
          opts: {
            removeOnComplete: 100,
            removeOnFail: 50,
          },
        },
      ),
    ]);

    this.logger.log('Recurring queue schedulers are configured (including sequence workers)');
  }
}
