import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  NotFoundException,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { PrismaService } from '../prisma';
import { PipelineService } from './pipeline.service';
import { UpdatePipelineStageDto } from './dto/update-pipeline-stage.dto';
import { PipelineStage } from '@prisma/client';
import type { User } from '@prisma/client';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('pipeline')
@Controller('api/pipeline')
export class PipelineController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pipelineService: PipelineService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get all contacts in the pipeline' })
  async getPipeline(@CurrentUser() user: User) {
    const contacts = await this.prisma.contact.findMany({
      where: {
        userId: user.id,
        pipelineStage: { not: PipelineStage.none },
        isArchived: false,
        inclusionStatus: 'active',
      },
      orderBy: { pipelineUpdatedAt: 'desc' },
    });

    // Group by stage
    const pipeline: Record<string, typeof contacts> = {
      intro: contacts.filter((c) => c.pipelineStage === PipelineStage.intro),
      meeting: contacts.filter(
        (c) => c.pipelineStage === PipelineStage.meeting,
      ),
      dd: contacts.filter((c) => c.pipelineStage === PipelineStage.dd),
      term_sheet: contacts.filter(
        (c) => c.pipelineStage === PipelineStage.term_sheet,
      ),
      closed_won: contacts.filter(
        (c) => c.pipelineStage === PipelineStage.closed_won,
      ),
      closed_lost: contacts.filter(
        (c) => c.pipelineStage === PipelineStage.closed_lost,
      ),
      paused: contacts.filter((c) => c.pipelineStage === PipelineStage.paused),
    };

    return pipeline;
  }

  @Get('velocity')
  @ApiOperation({ summary: 'Get pipeline velocity metrics' })
  async getVelocity(@CurrentUser() user: User) {
    return this.pipelineService.getVelocity(user.id);
  }

  @Patch(':contactId')
  @ApiOperation({ summary: 'Update pipeline stage for a contact' })
  async updatePipelineStage(
    @CurrentUser() user: User,
    @Param('contactId') contactId: string,
    @Body() dto: UpdatePipelineStageDto,
  ) {
    const contact = await this.prisma.contact.findFirst({
      where: { id: contactId, userId: user.id },
    });
    if (!contact) throw new NotFoundException('Contact not found');

    return this.pipelineService.moveStage(
      user.id,
      contactId,
      dto.stage,
      'manual',
    );
  }

  @Get('events/:contactId')
  @ApiOperation({ summary: 'Get pipeline stage change history' })
  async getEvents(
    @CurrentUser() user: User,
    @Param('contactId') contactId: string,
  ) {
    return this.pipelineService.getContactEvents(user.id, contactId);
  }
}
