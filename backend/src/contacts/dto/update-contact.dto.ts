import { IsOptional, IsString, IsEnum } from 'class-validator';
import { WarmthTier, PipelineStage } from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateContactDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ enum: PipelineStage })
  @IsOptional()
  @IsEnum(PipelineStage)
  pipelineStage?: PipelineStage;

  @ApiPropertyOptional({ enum: WarmthTier })
  @IsOptional()
  @IsEnum(WarmthTier)
  warmthTierOverride?: WarmthTier;
}
