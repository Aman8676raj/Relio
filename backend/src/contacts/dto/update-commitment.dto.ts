import { IsInt, IsIn, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateCommitmentDto {
  @ApiProperty({ description: 'Index of the commitment to update' })
  @IsInt()
  @Min(0)
  index: number;

  @ApiProperty({ enum: ['open', 'dismissed', 'completed'] })
  @IsIn(['open', 'dismissed', 'completed'])
  status: 'open' | 'dismissed' | 'completed';
}
