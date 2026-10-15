import {
  Controller, Get, Post, Put, Body, Param, Query,
  Patch, Res, Header,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { Public } from '../auth/public.decorator';
import { SequenceService } from './sequence.service';
import {
  CreateSequenceDto,
  EnrollContactsDto,
  ApproveEmailDto,
  QuerySequencesDto,
} from './dto/sequence.dto';
import { UpdateSequenceStatusDto } from './dto/update-sequence-status.dto';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PrismaService } from '../prisma';

// 1x1 transparent GIF pixel (43 bytes)
const TRACKING_PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64',
);

@ApiTags('sequences')
@Controller('api/sequences')
export class SequenceController {
  constructor(
    private readonly service: SequenceService,
    private readonly prisma: PrismaService,
  ) {}

  // ─── Open Tracking (UNAUTHENTICATED) ─────────────────────────────────────

  @Public()
  @Get('track/:emailId/pixel.gif')
  @Header('Content-Type', 'image/gif')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  @ApiOperation({ summary: 'Email open tracking pixel (no auth)' })
  async trackOpen(
    @Param('emailId') emailId: string,
    @Res() res: any,
  ) {
    try {
      // Update the email open status (fire and forget)
      await this.prisma.sequenceEmail.updateMany({
        where: {
          id: emailId,
          status: 'sent', // Only update if currently 'sent' (not already opened/replied)
        },
        data: {
          status: 'opened',
          openedAt: new Date(),
        },
      });
    } catch {
      // Silently ignore errors — don't break the pixel response
    }

    res.end(TRACKING_PIXEL);
  }

  // ─── Sequence CRUD ──────────────────────────────────────────────────────

  @Post()
  @ApiOperation({ summary: 'Create a new outreach sequence' })
  async createSequence(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateSequenceDto,
  ) {
    return this.service.createSequence(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List sequences' })
  async listSequences(
    @CurrentUser() user: { id: string },
    @Query() dto: QuerySequencesDto,
  ) {
    return this.service.listSequences(user.id, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get sequence detail with enrollments' })
  async getSequence(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
  ) {
    return this.service.getSequence(user.id, id);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update sequence status (activate, pause, complete)' })
  async updateStatus(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: UpdateSequenceStatusDto,
  ) {
    return this.service.updateSequenceStatus(user.id, id, dto.status);
  }

  @Get(':id/analytics')
  @ApiOperation({ summary: 'Get sequence analytics' })
  async getAnalytics(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
  ) {
    return this.service.getSequenceAnalytics(user.id, id);
  }

  // ─── Enrollment ─────────────────────────────────────────────────────────

  @Post(':id/enroll')
  @ApiOperation({ summary: 'Enroll contacts into sequence (generates AI emails)' })
  async enrollContacts(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: EnrollContactsDto,
  ) {
    return this.service.enrollContacts(user.id, id, dto);
  }

  // ─── Email Approval ─────────────────────────────────────────────────────

  @Put('emails/:emailId/approve')
  @ApiOperation({ summary: 'Approve (and optionally edit) a sequence email' })
  async approveEmail(
    @CurrentUser() user: { id: string },
    @Param('emailId') emailId: string,
    @Body() dto: ApproveEmailDto,
  ) {
    return this.service.approveEmail(user.id, emailId, dto);
  }

  @Patch('enrollments/:enrollmentId/skip')
  @ApiOperation({ summary: 'Skip an enrollment' })
  async skipEnrollment(
    @CurrentUser() user: { id: string },
    @Param('enrollmentId') enrollmentId: string,
  ) {
    return this.service.skipEnrollment(user.id, enrollmentId);
  }

  @Post(':id/batch-approve')
  @ApiOperation({ summary: 'Approve all draft emails in sequence' })
  async batchApprove(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
  ) {
    return this.service.batchApprove(user.id, id);
  }
}
