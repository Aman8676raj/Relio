import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { GmailService } from '../gmail/gmail.service';
import { PrismaService } from '../prisma';

@Processor('gmail-sync')
export class GmailSyncProcessor extends WorkerHost {
  private readonly logger = new Logger(GmailSyncProcessor.name);

  constructor(
    private readonly gmailService: GmailService,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  async process(
    job: Job<{
      userId?: string;
      type?: 'full' | 'incremental';
      mode?: 'incremental';
    }>,
  ): Promise<{
    contactsFound: number;
    threadsStored: number;
    processedUsers?: number;
  }> {
    if (job.name === 'sync-all') {
      const users = await this.prisma.user.findMany({
        where: { googleAccessToken: { not: null } },
        select: { id: true },
      });

      let contactsFound = 0;
      let threadsStored = 0;

      for (const user of users) {
        try {
          const stats = await this.gmailService.incrementalGmailSync(user.id);
          contactsFound += stats.contactsFound;
          threadsStored += stats.threadsStored;
        } catch (error) {
          this.logger.error(
            `Scheduled Gmail sync failed for user ${user.id}`,
            error,
          );
        }
      }

      return {
        contactsFound,
        threadsStored,
        processedUsers: users.length,
      };
    }

    const { userId, type } = job.data;
    if (!userId || !type) {
      throw new Error('User sync job missing required userId/type payload');
    }

    this.logger.log(`Processing ${type} Gmail sync for user ${userId}`);

    try {
      if (type === 'full') {
        return await this.gmailService.fullGmailSync(userId);
      } else {
        return await this.gmailService.incrementalGmailSync(userId);
      }
    } catch (error) {
      this.logger.error(`Gmail sync failed for user ${userId}`, error);
      throw error;
    }
  }
}
