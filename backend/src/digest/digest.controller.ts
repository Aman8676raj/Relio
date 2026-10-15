import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { DigestService } from './digest.service';
import type { User } from '@prisma/client';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('digest')
@Controller('api/digest')
export class DigestController {
  constructor(private readonly digestService: DigestService) {}

  @Get('preview')
  @ApiOperation({ summary: "Preview today's digest contacts" })
  async previewDigest(@CurrentUser() user: User) {
    const contacts = await this.digestService.selectDigestContacts(user.id);
    return { contacts };
  }

  @Get('dashboard')
  @ApiOperation({ summary: 'In-app morning digest summary' })
  async getDashboardDigest(@CurrentUser() user: User) {
    return this.digestService.getDashboardDigest(user.id);
  }
}
