/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { Controller, Get, Patch, Body } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { PrismaService } from '../prisma';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import type { User } from '@prisma/client';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

// Default preferences shape
const DEFAULT_PREFERENCES = {
  notifications: {
    digestEnabled: false,
    digestTime: '08:00 AM',
    timezone: 'UTC',
    hotAlerts: true,
    weeklyReport: false,
  },
  ai: {
    autoGenerate: false,
    tone: 'Warm & Professional',
    length: 'Concise (< 100 words)',
    includeSignature: true,
  },
};

@ApiTags('settings')
@Controller('api/settings')
export class SettingsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Get user settings and preferences' })
  async getSettings(@CurrentUser() user: User) {
    const fullUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        name: true,
        timezone: true,
        preferences: true,
        googleAccessToken: true,
        lastSyncAt: true,
        createdAt: true,
      },
    });

    const prefs = {
      ...DEFAULT_PREFERENCES,
      ...((fullUser?.preferences as Record<string, any>) || {}),
    };

    // Merge nested objects
    prefs.notifications = {
      ...DEFAULT_PREFERENCES.notifications,
      ...((fullUser?.preferences as any)?.notifications || {}),
      timezone: fullUser?.timezone || 'UTC',
    };
    prefs.ai = {
      ...DEFAULT_PREFERENCES.ai,
      ...((fullUser?.preferences as any)?.ai || {}),
    };

    return {
      profile: {
        id: fullUser?.id,
        email: fullUser?.email,
        name: fullUser?.name,
        createdAt: fullUser?.createdAt,
      },
      integrations: {
        gmail: {
          connected: !!fullUser?.googleAccessToken,
          email: fullUser?.googleAccessToken ? fullUser.email : null,
          lastSyncAt: fullUser?.lastSyncAt,
        },
        calendar: { connected: false },
        linkedin: { connected: false },
      },
      preferences: prefs,
    };
  }

  @Patch()
  @ApiOperation({ summary: 'Update user preferences' })
  async updateSettings(@CurrentUser() user: User, @Body() dto: UpdateSettingsDto) {
    const currentUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { preferences: true, timezone: true },
    });

    const currentPrefs =
      (currentUser?.preferences as Record<string, any>) || {};

    // Deep merge incoming changes
    const merged: Record<string, any> = { ...currentPrefs };

    if (dto.notifications) {
      merged.notifications = {
        ...DEFAULT_PREFERENCES.notifications,
        ...(currentPrefs.notifications || {}),
        ...dto.notifications,
      };
    }

    if (dto.ai) {
      merged.ai = {
        ...DEFAULT_PREFERENCES.ai,
        ...(currentPrefs.ai || {}),
        ...dto.ai,
      };
    }

    // Update both preferences JSON and timezone on User model
    const updateData: any = { preferences: merged };
    if (dto.notifications?.timezone) {
      updateData.timezone = dto.notifications.timezone;
    }

    // Update profile fields if provided
    if (dto.name !== undefined) {
      updateData.name = dto.name;
    }
    if (dto.email !== undefined) {
      updateData.email = dto.email;
    }

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        timezone: true,
        preferences: true,
      },
    });

    return {
      success: true,
      profile: {
        id: updated.id,
        email: updated.email,
        name: updated.name,
      },
      preferences: {
        ...DEFAULT_PREFERENCES,
        ...((updated.preferences as Record<string, any>) || {}),
        notifications: {
          ...DEFAULT_PREFERENCES.notifications,
          ...((updated.preferences as any)?.notifications || {}),
          timezone: updated.timezone,
        },
        ai: {
          ...DEFAULT_PREFERENCES.ai,
          ...((updated.preferences as any)?.ai || {}),
        },
      },
    };
  }
}
