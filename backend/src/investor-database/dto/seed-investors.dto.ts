import { IsArray, ArrayMinSize } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

import { InvestorSeedRecord } from '../../common/interfaces';

export class SeedInvestorsDto {
  @ApiProperty({ description: 'Array of investor records to seed', type: [Object] })
  @IsArray()
  @ArrayMinSize(1)
  investors: InvestorSeedRecord[];
}
