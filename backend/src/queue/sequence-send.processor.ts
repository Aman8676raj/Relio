import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma';
import { GmailService } from '../gmail/gmail.service';
import { SequenceStepConfig } from '../common/interfaces';

@Injectable()
@Processor('sequence-send')
export class SequenceSendProcessor extends WorkerHost {
  private readonly logger = new Logger(SequenceSendProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gmailService: GmailService,
  ) {
    super();
  }

  async process(_job: Job): Promise<void> {
    this.logger.log('Running sequence send sweep...');

    const now = new Date();

    // Find all active enrollments that are due to send
    // Use raw query approach to avoid include type issues
    const dueEnrollments = await this.prisma.sequenceEnrollment.findMany({
      where: {
        status: 'active',
        nextSendAt: { lte: now },
      },
    });

    this.logger.log(`Found ${dueEnrollments.length} enrollments due to send`);

    let sent = 0;
    let errors = 0;

    for (const enrollment of dueEnrollments) {
      try {
        // Fetch related data individually to avoid include type issues
        const contact = await this.prisma.contact.findUnique({
          where: { id: enrollment.contactId },
          select: { id: true, email: true, name: true },
        });

        if (!contact?.email) {
          this.logger.warn(`No email address for contact ${enrollment.contactId}`);
          continue;
        }

        // Find the approved email for the current step
        const currentEmail = await this.prisma.sequenceEmail.findFirst({
          where: {
            enrollmentId: enrollment.id,
            stepNumber: enrollment.currentStep,
            status: 'approved',
          },
        });

        if (!currentEmail) {
          this.logger.warn(
            `No approved email for enrollment ${enrollment.id} at step ${enrollment.currentStep}`,
          );
          continue;
        }

        // Fetch sequence for step config
        const sequence = await this.prisma.sequence.findUnique({
          where: { id: enrollment.sequenceId },
        });

        if (!sequence) continue;

        // Send via Gmail
        const result = await this.gmailService.sendEmail(
          enrollment.userId,
          contact.email,
          currentEmail.subject || 'No subject',
          currentEmail.body || '',
        );

        // Update email record
        await this.prisma.sequenceEmail.update({
          where: { id: currentEmail.id },
          data: {
            status: 'sent',
            sentAt: now,
            gmailMessageId: result.messageId,
          },
        });

        // Advance to next step or complete
        const steps = (sequence.steps as any as SequenceStepConfig[]) || [];
        const nextStepNum = enrollment.currentStep + 1;
        const nextStepConfig = steps.find((s) => s.step === nextStepNum);

        if (nextStepConfig) {
          // Calculate next send date
          const nextSendAt = new Date();
          nextSendAt.setDate(nextSendAt.getDate() + (nextStepConfig.dayOffset || 0));

          // Check if next email already exists
          const existingNextEmail = await this.prisma.sequenceEmail.findFirst({
            where: {
              enrollmentId: enrollment.id,
              stepNumber: nextStepNum,
            },
          });

          if (!existingNextEmail) {
            // Create a draft placeholder for the next step
            try {
              await this.prisma.sequenceEmail.create({
                data: {
                  enrollmentId: enrollment.id,
                  stepNumber: nextStepNum,
                  subject: `Follow-up: Step ${nextStepNum}`,
                  body: `[Auto-generated follow-up pending approval]`,
                  status: 'draft',
                },
              });
            } catch {
              this.logger.warn(
                `Could not generate next email for enrollment ${enrollment.id}`,
              );
            }
          }

          await this.prisma.sequenceEnrollment.update({
            where: { id: enrollment.id },
            data: {
              currentStep: nextStepNum,
              nextSendAt,
            },
          });
        } else {
          // No more steps — mark as completed
          await this.prisma.sequenceEnrollment.update({
            where: { id: enrollment.id },
            data: {
              status: 'completed',
              nextSendAt: null,
            },
          });
        }

        sent++;
      } catch (err: any) {
        this.logger.error(
          `Failed to send for enrollment ${enrollment.id}: ${err.message}`,
        );
        errors++;
      }
    }

    this.logger.log(
      `Sequence send sweep complete: ${sent} sent, ${errors} errors`,
    );
  }
}
