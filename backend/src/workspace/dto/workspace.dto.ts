import { IsEmail, IsOptional, IsString, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class InviteMemberDto {
  @ApiProperty({ description: 'Email of the member to invite' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ enum: ['owner', 'contributor', 'viewer'], default: 'contributor' })
  @IsOptional()
  @IsIn(['owner', 'contributor', 'viewer'])
  role?: string;
}

export class UpdateMemberRoleDto {
  @ApiProperty({ enum: ['owner', 'contributor', 'viewer'] })
  @IsIn(['owner', 'contributor', 'viewer'])
  role: string;
}

export class AddNoteDto {
  @ApiProperty({ description: 'Note body text' })
  @IsString()
  body: string;
}
