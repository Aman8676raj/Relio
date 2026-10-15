import { Injectable, Logger, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma';

@Injectable()
export class WorkspaceService {
  private readonly logger = new Logger(WorkspaceService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Get or create an organization for this user (1:1 for now, expands to multi-user) */
  async getOrCreateOrg(userId: string, userEmail: string) {
    // Check if user is already a member of an org
    const membership = await this.prisma.orgMember.findFirst({
      where: { userId },
      include: { org: true },
    });

    if (membership) return { org: membership.org, role: membership.role };

    // Create a new org from the user's email domain
    const domain = userEmail.split('@')[1] ?? userEmail;
    const slug = domain.replace(/\./g, '-').toLowerCase() + '-' + Date.now().toString().slice(-4);

    const org = await this.prisma.organization.create({
      data: {
        name: domain,
        slug,
        members: {
          create: {
            userId,
            role: 'owner',
          },
        },
      },
    });

    return { org, role: 'owner' };
  }

  async inviteMember(inviterUserId: string, inviteeEmail: string, role: string) {
    const { org } = await this.getOrCreateOrg(inviterUserId, inviteeEmail);

    // Check inviter is owner or contributor
    const inviterMembership = await this.prisma.orgMember.findFirst({
      where: { userId: inviterUserId, orgId: org.id },
    });
    if (!inviterMembership || inviterMembership.role === 'viewer') {
      throw new ForbiddenException('Only owners and contributors can invite members');
    }

    // Prevent role escalation — only owners can assign owner role
    if (role === 'owner' && inviterMembership.role !== 'owner') {
      throw new ForbiddenException('Only owners can invite new owners');
    }

    // Find invitee user if exists
    const invitee = await this.prisma.user.findUnique({ where: { email: inviteeEmail } });

    if (!invitee) {
      // Return invite link / token (would send email in production)
      this.logger.log(`Invite sent to ${inviteeEmail} for org ${org.id}`);
      return { status: 'invited', email: inviteeEmail, orgId: org.id };
    }

    // Check not already a member
    const existing = await this.prisma.orgMember.findFirst({
      where: { orgId: org.id, userId: invitee.id },
    });
    if (existing) return { status: 'already_member', member: existing };

    const member = await this.prisma.orgMember.create({
      data: {
        orgId: org.id,
        userId: invitee.id,
        role,
        invitedBy: inviterUserId,
      },
    });

    return { status: 'added', member };
  }

  async getMembers(userId: string) {
    const membership = await this.prisma.orgMember.findFirst({ where: { userId } });
    if (!membership) return [];

    return this.prisma.orgMember.findMany({
      where: { orgId: membership.orgId },
      orderBy: { joinedAt: 'asc' },
    });
  }

  async updateRole(actingUserId: string, memberId: string, newRole: string) {
    const actorMembership = await this.prisma.orgMember.findFirst({
      where: { userId: actingUserId },
    });
    if (!actorMembership || actorMembership.role !== 'owner') {
      throw new ForbiddenException('Only owners can change roles');
    }

    return this.prisma.orgMember.update({
      where: { id: memberId },
      data: { role: newRole },
    });
  }

  async removeMember(actingUserId: string, memberId: string) {
    const actorMembership = await this.prisma.orgMember.findFirst({
      where: { userId: actingUserId },
    });
    if (!actorMembership || actorMembership.role !== 'owner') {
      throw new ForbiddenException('Only owners can remove members');
    }

    return this.prisma.orgMember.delete({ where: { id: memberId } });
  }

  async addNote(userId: string, userEmail: string, contactId: string, body: string) {
    // If no org, create a personal note under a synthetic org
    const { org } = await this.getOrCreateOrg(userId, userEmail);

    const note = await this.prisma.contactNote.create({
      data: {
        contactId,
        orgId: org.id,
        authorId: userId,
        body,
      },
    });

    // Log to activity feed
    await this.prisma.activityFeed.create({
      data: {
        orgId: org.id,
        userId,
        contactId,
        activityType: 'note_added',
        metadata: { noteId: note.id, preview: body.slice(0, 100) },
      },
    });

    return note;
  }

  async getNotes(userId: string, userEmail: string, contactId: string) {
    const { org } = await this.getOrCreateOrg(userId, userEmail);
    return this.prisma.contactNote.findMany({
      where: { orgId: org.id, contactId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getActivityFeed(userId: string) {
    const membership = await this.prisma.orgMember.findFirst({ where: { userId } });
    if (!membership) return [];

    return this.prisma.activityFeed.findMany({
      where: { orgId: membership.orgId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async logActivity(orgId: string, userId: string, contactId: string | null, type: string, metadata: object = {}) {
    return this.prisma.activityFeed.create({
      data: { orgId, userId, contactId, activityType: type, metadata },
    });
  }
}
