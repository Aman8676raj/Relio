import { IsOptional, IsString, IsUUID, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';

export class CreateShareDto {
  @ApiPropertyOptional({ description: 'Contact to associate share with' })
  @IsOptional()
  @IsUUID()
  contactId?: string;

  @ApiPropertyOptional({ description: 'Number of days before link expires' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  expiresInDays?: number;
}

export class TrackPageDto {
  @ApiProperty({ description: 'View session ID' })
  @IsUUID()
  viewId: string;

  @ApiProperty({ description: 'Page number viewed' })
  @IsInt()
  @Min(1)
  page: number;

  @ApiProperty({ description: 'Seconds spent on page' })
  @IsInt()
  @Min(0)
  seconds: number;
}

export class CompleteViewDto {
  @ApiProperty({ description: 'View session ID to complete' })
  @IsUUID()
  viewId: string;
}
