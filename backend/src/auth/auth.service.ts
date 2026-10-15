import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import type { User } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async signup(email: string, password: string, name?: string) {
    // Check if user exists
    const existing = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existing) {
      throw new ConflictException('User with this email already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
      },
    });

    // Auto-provision org + owner membership
    await this.ensureOrgMembership(user.id, name || email);

    return this.createJwt(user);
  }

  /**
   * Ensures a user has an organization and owner membership.
   * Creates both lazily if they don't exist yet.
   * Safe to call multiple times (idempotent).
   */
  async ensureOrgMembership(userId: string, displayName: string) {
    const existingMembership = await this.prisma.orgMember.findFirst({
      where: { userId },
    });

    if (existingMembership) return existingMembership;

    // Generate a slug from the display name
    const baseSlug = displayName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 80) || 'my-org';
    const slug = `${baseSlug}-${Date.now().toString(36)}`;

    const org = await this.prisma.organization.create({
      data: {
        name: `${displayName}'s Workspace`,
        slug,
      },
    });

    return this.prisma.orgMember.create({
      data: {
        orgId: org.id,
        userId,
        role: 'owner',
      },
    });
  }

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);

    if (!isMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.createJwt(user);
  }

  private createJwt(user: User) {
    const payload = {
      sub: user.id,
      email: user.email,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    };
  }

  async validatePassword(plaintext: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plaintext, hash);
  }

  async hashPassword(plaintext: string): Promise<string> {
    return bcrypt.hash(plaintext, 10);
  }
}
