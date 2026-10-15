import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { PrismaService } from '../prisma';
import { ContactBriefingService } from './contact-briefing.service';
import { IntroPathService } from './intro-path.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { UpdateCommitmentDto } from './dto/update-commitment.dto';
import { UpdateContactInclusionDto } from './dto/update-contact-inclusion.dto';
import { WarmthTier, PipelineStage, Prisma } from '@prisma/client';
import type { User } from '@prisma/client';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';

@ApiTags('contacts')
@Controller('api/contacts')
export class ContactsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly briefingService: ContactBriefingService,
    private readonly introPathService: IntroPathService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new contact manually' })
  async createContact(
    @CurrentUser() user: User,
    @Body() dto: CreateContactDto,
  ) {
    // Check for duplicate
    const existing = await this.prisma.contact.findFirst({
      where: { userId: user.id, email: dto.email },
    });
    if (existing) {
      throw new ConflictException('A contact with this email already exists');
    }

    const stage = dto.pipelineStage || PipelineStage.none;

    const contact = await this.prisma.contact.create({
      data: {
        userId: user.id,
        email: dto.email,
        name: dto.name || null,
        company: dto.company || null,
        isManual: true,
        notes: dto.notes || null,
        warmthTier: 'cold',
        pipelineStage: stage,
        pipelineUpdatedAt: stage !== PipelineStage.none ? new Date() : null,
        firstContactedAt: new Date(),
        lastContactedAt: new Date(),
        inclusionStatus: 'active',
        exclusionReason: null,
      },
    });

    return contact;
  }

  @Get()
  @ApiOperation({
    summary: 'List contacts with filtering, sorting, and search',
  })
  @ApiQuery({
    name: 'sort',
    required: false,
    enum: [
      'last_contacted_asc',
      'last_contacted_desc',
      'warmth_desc',
      'name_asc',
    ],
  })
  @ApiQuery({ name: 'archived', required: false, type: String, description: 'true for archived, false for active, omit for all' })
  @ApiQuery({ name: 'tier', required: false, enum: WarmthTier })
  @ApiQuery({ name: 'pipeline_stage', required: false, enum: PipelineStage })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async listContacts(
    @CurrentUser() user: User,
    @Query('sort') sort: string = 'last_contacted_asc',
    @Query('tier') tier?: WarmthTier,
    @Query('pipeline_stage') pipelineStage?: PipelineStage,
    @Query('search') search?: string,
    @Query('archived') archived?: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '50',
  ) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
    const offset = (pageNum - 1) * limitNum;

    const where: Prisma.ContactWhereInput = {
      userId: user.id,
    };

    if (archived === 'true') {
      where.isArchived = true;
    } else if (archived === 'false') {
      where.isArchived = false;
      where.inclusionStatus = 'active';
    } else {
      // Default / "All"
      where.inclusionStatus = 'active';
    }

    if (tier) where.warmthTier = tier;
    if (pipelineStage) where.pipelineStage = pipelineStage;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const sortMap: Record<string, Prisma.ContactOrderByWithRelationInput> = {
      last_contacted_asc: { lastContactedAt: 'asc' },
      last_contacted_desc: { lastContactedAt: 'desc' },
      warmth_desc: { warmthScore: 'desc' },
      name_asc: { name: 'asc' },
    };
    const orderBy = sortMap[sort] || sortMap.last_contacted_asc;

    const [contacts, total] = await Promise.all([
      this.prisma.contact.findMany({
        where,
        orderBy,
        skip: offset,
        take: limitNum,
      }),
      this.prisma.contact.count({ where }),
    ]);

    return {
      data: contacts,
      meta: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    };
  }

  @Get('pending-review')
  @ApiOperation({ summary: 'List contacts pending inclusion review' })
  async listPendingReviewContacts(@CurrentUser() user: User) {
    const contacts = await this.prisma.contact.findMany({
      where: {
        userId: user.id,
        isArchived: false,
        inclusionStatus: 'pending_review',
      },
      orderBy: { lastContactedAt: 'desc' },
    });

    return {
      data: contacts,
      meta: {
        page: 1,
        limit: contacts.length,
        total: contacts.length,
        totalPages: 1,
      },
    };
  }

  @Get('intro-paths')
  @ApiOperation({ summary: 'Get top intro paths across all contacts' })
  async getTopIntroPaths(@CurrentUser() user: User) {
    return this.introPathService.getTopIntroPaths(user.id);
  }

  @Post('intro-paths/compute')
  @ApiOperation({ summary: 'Recompute intro paths from email data' })
  async computeIntroPaths(@CurrentUser() user: User) {
    const count = await this.introPathService.computeIntroPaths(user.id);
    return { success: true, pathsComputed: count };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get single contact with thread summaries' })
  async getContact(@CurrentUser() user: User, @Param('id') id: string) {
    const contact = await this.prisma.contact.findFirst({
      where: { id, userId: user.id },
    });
    if (!contact) throw new NotFoundException('Contact not found');

    const threads = await this.prisma.emailThread.findMany({
      where: { contactId: id },
      orderBy: { lastMessageAt: 'desc' },
      take: 5,
      select: {
        id: true,
        subject: true,
        snippet: true,
        messageCount: true,
        lastMessageAt: true,
      },
    });

    return { ...contact, threads };
  }

  @Get(':id/briefing')
  @ApiOperation({ summary: 'Get AI-generated contact briefing / memory doc' })
  async getBriefing(@CurrentUser() user: User, @Param('id') contactId: string) {
    return this.briefingService.getBriefing(contactId, user.id);
  }

  @Patch(':id/briefing/commitments')
  @ApiOperation({ summary: 'Update commitment status (dismiss/confirm)' })
  async updateCommitment(
    @CurrentUser() user: User,
    @Param('id') contactId: string,
    @Body() dto: UpdateCommitmentDto,
  ) {
    return this.briefingService.updateCommitmentStatus(
      contactId,
      user.id,
      dto.index,
      dto.status,
    );
  }

  @Patch(':id/inclusion')
  @ApiOperation({ summary: 'Promote or dismiss a pending-review contact' })
  async updateContactInclusion(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: UpdateContactInclusionDto,
  ) {
    const contact = await this.prisma.contact.findFirst({
      where: { id, userId: user.id },
    });
    if (!contact) throw new NotFoundException('Contact not found');
    if (contact.inclusionStatus !== 'pending_review') {
      throw new ConflictException(
        'Only pending review contacts can be triaged',
      );
    }

    return this.prisma.contact.update({
      where: { id },
      data: {
        inclusionStatus: dto.status,
        exclusionReason:
          dto.status === 'active'
            ? null
            : contact.exclusionReason || 'unidirectional',
      },
    });
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update contact notes, pipeline stage, or warmth override',
  })
  async updateContact(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: UpdateContactDto,
  ) {
    const contact = await this.prisma.contact.findFirst({
      where: { id, userId: user.id },
    });
    if (!contact) throw new NotFoundException('Contact not found');

    const updateData: Prisma.ContactUpdateInput = {};

    if (dto.notes !== undefined) updateData.notes = dto.notes;
    if (dto.pipelineStage !== undefined) {
      updateData.pipelineStage = dto.pipelineStage;
      updateData.pipelineUpdatedAt = new Date();
    }
    if (dto.warmthTierOverride !== undefined) {
      updateData.warmthTierOverride = dto.warmthTierOverride;
      updateData.warmthTier = dto.warmthTierOverride; // Apply immediately
    }

    return this.prisma.contact.update({
      where: { id },
      data: updateData,
    });
  }

  @Get(':id/intro-paths')
  @ApiOperation({ summary: 'Get intro paths for a specific contact' })
  async getContactIntroPaths(
    @CurrentUser() user: User,
    @Param('id') contactId: string,
  ) {
    return this.introPathService.getIntroPathsForContact(user.id, contactId);
  }
}
