import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { WorkspaceService } from './workspace.service';
import { InviteMemberDto, UpdateMemberRoleDto, AddNoteDto } from './dto/workspace.dto';
import type { User } from '@prisma/client';

@ApiTags('workspace')
@Controller('api/workspace')
@Roles() // any authenticated org member
export class WorkspaceController {
  constructor(private readonly workspaceService: WorkspaceService) {}

  @Get('org')
  @ApiOperation({ summary: 'Get or create current user organization' })
  async getOrg(@CurrentUser() user: User) {
    return this.workspaceService.getOrCreateOrg(user.id, user.email);
  }

  @Post('invite')
  @Roles('owner', 'contributor')
  @ApiOperation({ summary: 'Invite a team member by email' })
  async invite(@CurrentUser() user: User, @Body() dto: InviteMemberDto) {
    return this.workspaceService.inviteMember(user.id, dto.email, dto.role ?? 'contributor');
  }

  @Get('members')
  @ApiOperation({ summary: 'List organization members' })
  async getMembers(@CurrentUser() user: User) {
    return this.workspaceService.getMembers(user.id);
  }

  @Patch('members/:memberId/role')
  @Roles('owner')
  @ApiOperation({ summary: 'Update a member role (owner only)' })
  async updateRole(
    @CurrentUser() user: User,
    @Param('memberId') memberId: string,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    return this.workspaceService.updateRole(user.id, memberId, dto.role);
  }

  @Post('members/:memberId/remove')
  @Roles('owner')
  @ApiOperation({ summary: 'Remove a team member (owner only)' })
  async removeMember(@CurrentUser() user: User, @Param('memberId') memberId: string) {
    return this.workspaceService.removeMember(user.id, memberId);
  }

  @Post('contacts/:contactId/notes')
  @Roles('owner', 'contributor')
  @ApiOperation({ summary: 'Add a shared note to a contact' })
  async addNote(
    @CurrentUser() user: User,
    @Param('contactId') contactId: string,
    @Body() dto: AddNoteDto,
  ) {
    return this.workspaceService.addNote(user.id, user.email, contactId, dto.body);
  }

  @Get('contacts/:contactId/notes')
  @ApiOperation({ summary: 'Get shared notes for a contact' })
  async getNotes(@CurrentUser() user: User, @Param('contactId') contactId: string) {
    return this.workspaceService.getNotes(user.id, user.email, contactId);
  }

  @Get('activity')
  @ApiOperation({ summary: 'Get organization activity feed' })
  async getActivity(@CurrentUser() user: User) {
    return this.workspaceService.getActivityFeed(user.id);
  }
}
