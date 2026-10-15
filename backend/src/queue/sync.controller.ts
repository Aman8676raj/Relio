import {
  Controller,
  Post,
  Get,
  Param,
  Logger,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { CurrentUser } from '../auth/current-user.decorator';
import { GmailService } from '../gmail/gmail.service';
import type { User } from '@prisma/client';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('sync')
@Controller('api/sync')
export class SyncController {
  private readonly logger = new Logger(SyncController.name);

  constructor(
    @InjectQueue('gmail-sync') private readonly gmailQueue: Queue,
    private readonly gmailService: GmailService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Trigger Gmail sync (via queue)' })
  async triggerSync(@CurrentUser() user: User) {
    const job = await this.gmailQueue.add('sync', {
      userId: user.id,
      type: user.lastSyncAt ? 'incremental' : 'full',
    });

    return { taskId: job.id, status: 'queued' };
  }

  @Post('direct')
  @ApiOperation({ summary: 'Trigger Gmail sync directly (no queue)' })
  async triggerDirectSync(@CurrentUser() user: User) {
    this.logger.log(`Starting direct sync for user ${user.id}`);
    try {
      const stats = await this.gmailService.fullGmailSync(user.id);
      return { status: 'completed', ...stats };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Direct sync failed: ${msg}`);
      return { status: 'failed', error: msg };
    }
  }

  @Get(':taskId')
  @ApiOperation({ summary: 'Check sync task status' })
  async getSyncStatus(@Param('taskId') taskId: string) {
    const job = await this.gmailQueue.getJob(taskId);
    if (!job) {
      return { status: 'not_found' };
    }

    const state = await job.getState();
    const progress = job.progress;

    return {
      taskId: job.id,
      status: state,
      progress,
      stats: (job.returnvalue as unknown) || null,
      error: job.failedReason || null,
    };
  }
}
