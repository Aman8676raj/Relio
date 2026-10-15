import { IsEnum } from 'class-validator';
import { PipelineStage } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';

export class UpdatePipelineStageDto {
  @ApiProperty({ enum: PipelineStage, description: 'Target pipeline stage' })
  @IsEnum(PipelineStage)
  stage: PipelineStage;
}
