import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { DigestService } from '../digest/digest.service';

@Processor('morning-digest')
export class DigestProcessor extends WorkerHost {
  private readonly logger = new Logger(DigestProcessor.name);

  constructor(private readonly digestService: DigestService) {
    super();
  }

  async process(): Promise<{ sentCount: number }> {
    this.logger.log('Processing morning digest cron');
    const sentCount = await this.digestService.processDigestsForHour();
    return { sentCount };
  }
}
