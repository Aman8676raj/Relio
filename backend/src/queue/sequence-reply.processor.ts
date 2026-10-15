import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma';
import { GmailService } from '../gmail/gmail.service';

@Injectable()
@Processor('sequence-reply')
export class SequenceReplyProcessor extends WorkerHost {
  private readonly logger = new Logger(SequenceReplyProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gmailService: GmailService,
  ) {
    super();
  }

  async process(_job: Job): Promise<void> {
    this.logger.log('Running sequence reply detection...');

    // Find all active enrollments
    const activeEnrollments = await this.prisma.sequenceEnrollment.findMany({
      where: {
        status: 'active',
      },
    });

    this.logger.log(
      `Checking ${activeEnrollments.length} active enrollments for replies`,
    );

    let repliesDetected = 0;

    for (const enrollment of activeEnrollments) {
      // Find the most recently sent email for this enrollment
      const sentEmail = await this.prisma.sequenceEmail.findFirst({
        where: {
          enrollmentId: enrollment.id,
          status: 'sent',
          gmailMessageId: { not: null },
        },
        orderBy: { sentAt: 'desc' },
      });

      if (!sentEmail?.gmailMessageId || !sentEmail.sentAt) continue;

      try {
        const { hasReply, replyAt } = await this.gmailService.checkForReplies(
          enrollment.userId,
          sentEmail.gmailMessageId,
          sentEmail.sentAt,
        );

        if (hasReply) {
          this.logger.log(
            `Reply detected for enrollment ${enrollment.id}, halting sequence`,
          );

          // Mark enrollment as replied
          await this.prisma.sequenceEnrollment.update({
            where: { id: enrollment.id },
            data: {
              status: 'replied',
              repliedAt: replyAt || new Date(),
              nextSendAt: null, // Stop further sends
            },
          });

          // Update the email status
          await this.prisma.sequenceEmail.update({
            where: { id: sentEmail.id },
            data: { status: 'replied' },
          });

          repliesDetected++;
        }
      } catch (err: any) {
        this.logger.error(
          `Failed to check replies for enrollment ${enrollment.id}: ${err.message}`,
        );
      }
    }

    this.logger.log(
      `Reply detection complete: ${repliesDetected} replies found`,
    );
  }
}
