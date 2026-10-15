import { IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateSequenceStatusDto {
  @ApiProperty({ enum: ['draft', 'active', 'paused', 'completed'] })
  @IsIn(['draft', 'active', 'paused', 'completed'])
  status: string;
}
