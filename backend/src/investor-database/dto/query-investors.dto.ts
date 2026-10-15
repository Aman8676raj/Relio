import { IsOptional, IsString, IsInt, IsBoolean, Min, Max } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class QueryInvestorsDto {
  @ApiPropertyOptional({ description: 'Search term (name, fund, thesis)' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Investor type: vc, angel, family_office, corporate, accelerator' })
  @IsOptional()
  @IsString()
  investorType?: string;

  @ApiPropertyOptional({ description: 'Stage focus filter (comma-separated): pre-seed, seed, series-a, series-b, growth' })
  @IsOptional()
  @IsString()
  stageFocus?: string;

  @ApiPropertyOptional({ description: 'Sector focus filter (comma-separated)' })
  @IsOptional()
  @IsString()
  sectorFocus?: string;

  @ApiPropertyOptional({ description: 'Geography filter (comma-separated)' })
  @IsOptional()
  @IsString()
  geography?: string;

  @ApiPropertyOptional({ description: 'Minimum check size in USD' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  checkMin?: number;

  @ApiPropertyOptional({ description: 'Maximum check size in USD' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  checkMax?: number;

  @ApiPropertyOptional({ description: 'Filter to actively deploying funds only' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  activelyDeploying?: boolean;

  @ApiPropertyOptional({ description: 'Filter by data source tags (comma-separated), e.g. "ramp:angel_investors,ramp:seed"' })
  @IsOptional()
  @IsString()
  tags?: string;

  @ApiPropertyOptional({ description: 'Sort field: name, fundName, dataQualityScore, lastEnrichedAt, investmentCount18mo', default: 'name' })
  @IsOptional()
  @IsString()
  sortBy?: string;

  @ApiPropertyOptional({ description: 'Sort direction: asc or desc', default: 'asc' })
  @IsOptional()
  @IsString()
  sortDir?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 24 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
