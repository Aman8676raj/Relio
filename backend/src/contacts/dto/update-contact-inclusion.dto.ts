import { IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateContactInclusionDto {
  @ApiProperty({ enum: ['active', 'excluded'] })
  @IsIn(['active', 'excluded'])
  status: 'active' | 'excluded';
}
