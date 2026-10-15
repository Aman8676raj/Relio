import { IsOptional, IsString, IsArray, IsInt, Min, Max, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SequenceStepDto {
  @ApiProperty()
  step: number;

  @ApiProperty()
  dayOffset: number;

  @ApiProperty({ description: 'opening, followup, breakup' })
  emailType: string;

  @ApiPropertyOptional()
  subjectHint?: string;
}

export class CreateSequenceDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiPropertyOptional({ type: [SequenceStepDto] })
  @IsOptional()
  steps?: SequenceStepDto[];
}

export class EnrollContactsDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  contactIds: string[];
}

export class ApproveEmailDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  body?: string;
}

export class QuerySequencesDto {
  @ApiPropertyOptional({ description: 'draft, active, paused, completed' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
