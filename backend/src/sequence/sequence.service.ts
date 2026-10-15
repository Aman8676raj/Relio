import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma';
import { SequenceGeneratorService } from './sequence-generator.service';
import {
  CreateSequenceDto,
  EnrollContactsDto,
  ApproveEmailDto,
  QuerySequencesDto,
  SequenceStepDto,
} from './dto/sequence.dto';

import { SequenceStepConfig } from '../common/interfaces';

const DEFAULT_STEPS: SequenceStepConfig[] = [
  { step: 1, dayOffset: 0, emailType: 'opening', subjectHint: undefined },
  { step: 2, dayOffset: 6, emailType: 'followup', subjectHint: 'Re:' },
  { step: 3, dayOffset: 13, emailType: 'breakup', subjectHint: 'Closing the loop' },
];

@Injectable()
export class SequenceService {
  private readonly logger = new Logger(SequenceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly generator: SequenceGeneratorService,
  ) {}

  // ─── Sequence CRUD ──────────────────────────────────────────────────────

  async createSequence(userId: string, dto: CreateSequenceDto) {
    const steps = dto.steps && dto.steps.length > 0 ? dto.steps : DEFAULT_STEPS;

    return this.prisma.sequence.create({
      data: {
        userId,
        name: dto.name,
        steps: steps as any,
      },
      include: { _count: { select: { enrollments: true } } },
    });
  }

  async listSequences(userId: string, dto: QuerySequencesDto) {
    const page = dto.page || 1;
    const limit = dto.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = { userId };
    if (dto.status) where.status = dto.status;

    const [data, total] = await Promise.all([
      this.prisma.sequence.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          _count: { select: { enrollments: true } },
          enrollments: {
            select: { status: true },
          },
        },
      }),
      this.prisma.sequence.count({ where }),
    ]);

    // Compute stats per sequence
    const withStats = data.map((seq) => {
      const statuses = seq.enrollments.map((e) => e.status);
      return {
        ...seq,
        enrollments: undefined,
        stats: {
          total: statuses.length,
          draft: statuses.filter((s) => s === 'draft').length,
          approved: statuses.filter((s) => s === 'approved').length,
          active: statuses.filter((s) => s === 'active').length,
          replied: statuses.filter((s) => s === 'replied').length,
          completed: statuses.filter((s) => s === 'completed').length,
          skipped: statuses.filter((s) => s === 'skipped').length,
        },
      };
    });

    return {
      data: withStats,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getSequence(userId: string, sequenceId: string) {
    const sequence = await this.prisma.sequence.findFirst({
      where: { id: sequenceId, userId },
      include: {
        enrollments: {
          include: {
            contact: { select: { id: true, name: true, email: true, company: true, warmthTier: true } },
            emails: { orderBy: { stepNumber: 'asc' } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!sequence) throw new NotFoundException('Sequence not found');
    return sequence;
  }

  async updateSequenceStatus(userId: string, sequenceId: string, status: string) {
    const sequence = await this.prisma.sequence.findFirst({
      where: { id: sequenceId, userId },
    });
    if (!sequence) throw new NotFoundException('Sequence not found');

    const validTransitions: Record<string, string[]> = {
      draft: ['active'],
      active: ['paused', 'completed'],
      paused: ['active', 'completed'],
    };

    const allowed = validTransitions[sequence.status] || [];
    if (!allowed.includes(status)) {
      throw new BadRequestException(`Cannot transition from '${sequence.status}' to '${status}'`);
    }

    // When activating: move all approved enrollments to active + set next_send_at
    if (status === 'active') {
      const approvedEnrollments = await this.prisma.sequenceEnrollment.findMany({
        where: { sequenceId, status: 'approved' },
      });

      for (const enrollment of approvedEnrollments) {
        const steps = (sequence.steps as any as SequenceStepConfig[]) || [];
        const currentStepConfig = steps.find((s) => s.step === (enrollment.currentStep || 1));
        const sendDate = new Date();
        if (currentStepConfig && currentStepConfig.dayOffset > 0) {
          sendDate.setDate(sendDate.getDate() + currentStepConfig.dayOffset);
        }

        await this.prisma.sequenceEnrollment.update({
          where: { id: enrollment.id },
          data: {
            status: 'active',
            currentStep: enrollment.currentStep || 1,
            nextSendAt: sendDate,
          },
        });
      }
    }

    return this.prisma.sequence.update({
      where: { id: sequenceId },
      data: { status },
    });
  }

  // ─── Enrollment ─────────────────────────────────────────────────────────

  async enrollContacts(userId: string, sequenceId: string, dto: EnrollContactsDto) {
    const sequence = await this.prisma.sequence.findFirst({
      where: { id: sequenceId, userId },
    });
    if (!sequence) throw new NotFoundException('Sequence not found');

    const results: { contactId: string; enrollmentId: string; emailGenerated: boolean }[] = [];

    for (const contactId of dto.contactIds) {
      // Check contact exists and belongs to user
      const contact = await this.prisma.contact.findFirst({
        where: { id: contactId, userId },
      });
      if (!contact) continue;

      // Skip if already enrolled
      const existing = await this.prisma.sequenceEnrollment.findUnique({
        where: { uq_sequence_contact: { sequenceId, contactId } },
      });
      if (existing) continue;

      // Create enrollment
      const enrollment = await this.prisma.sequenceEnrollment.create({
        data: {
          sequenceId,
          contactId,
          userId,
          status: 'draft',
          currentStep: 1,
        },
      });

      // Generate first-step email
      let emailGenerated = false;
      try {
        const steps = (sequence.steps as any as SequenceStepConfig[]) || [];
        const firstStep = steps.find((s) => s.step === 1) || { emailType: 'opening', subjectHint: undefined };

        const generated = await this.generator.generateEmail(
          userId,
          contactId,
          firstStep.emailType,
          firstStep.subjectHint,
        );

        await this.prisma.sequenceEmail.create({
          data: {
            enrollmentId: enrollment.id,
            stepNumber: 1,
            subject: generated.subject,
            body: generated.body,
            status: 'draft',
          },
        });
        emailGenerated = true;
      } catch (err: any) {
        this.logger.error(`Failed to generate email for contact ${contactId}: ${err.message}`);
      }

      results.push({ contactId, enrollmentId: enrollment.id, emailGenerated });
    }

    return { enrolled: results.length, results };
  }

  // ─── Email Approval ─────────────────────────────────────────────────────

  async approveEmail(userId: string, emailId: string, dto?: ApproveEmailDto) {
    const email = await this.prisma.sequenceEmail.findUnique({
      where: { id: emailId },
      include: {
        enrollment: { select: { userId: true, id: true } },
      },
    });

    if (!email || email.enrollment.userId !== userId) {
      throw new NotFoundException('Email not found');
    }

    const updateData: any = {
      status: 'approved',
      approvedAt: new Date(),
    };

    if (dto?.subject) updateData.subject = dto.subject;
    if (dto?.body) updateData.body = dto.body;

    const updated = await this.prisma.sequenceEmail.update({
      where: { id: emailId },
      data: updateData,
    });

    // Check if all step-1 emails for this enrollment are approved
    // If so, move enrollment to approved
    const allEmails = await this.prisma.sequenceEmail.findMany({
      where: { enrollmentId: email.enrollment.id },
    });
    const allApproved = allEmails.every((e) => e.status === 'approved');
    if (allApproved) {
      await this.prisma.sequenceEnrollment.update({
        where: { id: email.enrollment.id },
        data: { status: 'approved' },
      });
    }

    return updated;
  }

  async skipEnrollment(userId: string, enrollmentId: string) {
    const enrollment = await this.prisma.sequenceEnrollment.findFirst({
      where: { id: enrollmentId, userId },
    });
    if (!enrollment) throw new NotFoundException('Enrollment not found');

    return this.prisma.sequenceEnrollment.update({
      where: { id: enrollmentId },
      data: { status: 'skipped' },
    });
  }

  async batchApprove(userId: string, sequenceId: string) {
    // Approve all draft emails in this sequence for this user
    const enrollments = await this.prisma.sequenceEnrollment.findMany({
      where: { sequenceId, userId, status: 'draft' },
      include: { emails: { where: { status: 'draft' } } },
    });

    let approved = 0;
    for (const enrollment of enrollments) {
      for (const email of enrollment.emails) {
        await this.prisma.sequenceEmail.update({
          where: { id: email.id },
          data: { status: 'approved', approvedAt: new Date() },
        });
        approved++;
      }
      await this.prisma.sequenceEnrollment.update({
        where: { id: enrollment.id },
        data: { status: 'approved' },
      });
    }

    return { approved, enrollments: enrollments.length };
  }

  // ─── Analytics ──────────────────────────────────────────────────────────

  async getSequenceAnalytics(userId: string, sequenceId: string) {
    const sequence = await this.prisma.sequence.findFirst({
      where: { id: sequenceId, userId },
    });
    if (!sequence) throw new NotFoundException('Sequence not found');

    const enrollments = await this.prisma.sequenceEnrollment.findMany({
      where: { sequenceId },
      include: {
        emails: true,
        contact: { select: { name: true, email: true } },
      },
    });

    const emails = enrollments.flatMap((e) => e.emails);

    return {
      sequenceId,
      sequenceName: sequence.name,
      status: sequence.status,
      totalEnrolled: enrollments.length,
      byStatus: {
        draft: enrollments.filter((e) => e.status === 'draft').length,
        approved: enrollments.filter((e) => e.status === 'approved').length,
        active: enrollments.filter((e) => e.status === 'active').length,
        replied: enrollments.filter((e) => e.status === 'replied').length,
        completed: enrollments.filter((e) => e.status === 'completed').length,
        skipped: enrollments.filter((e) => e.status === 'skipped').length,
      },
      emailStats: {
        total: emails.length,
        draft: emails.filter((e) => e.status === 'draft').length,
        approved: emails.filter((e) => e.status === 'approved').length,
        sent: emails.filter((e) => e.status === 'sent').length,
        opened: emails.filter((e) => e.status === 'opened').length,
        replied: emails.filter((e) => e.status === 'replied').length,
      },
      replyRate: emails.filter((e) => e.status === 'sent').length > 0
        ? Math.round((emails.filter((e) => e.status === 'replied').length / emails.filter((e) => e.status === 'sent').length) * 100)
        : 0,
    };
  }
}
