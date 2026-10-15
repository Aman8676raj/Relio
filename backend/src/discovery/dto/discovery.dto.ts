import { IsOptional, IsString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateStartupProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'pre-seed, seed, series-a, series-b' })
  @IsOptional()
  @IsString()
  stage?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sector?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  subSector?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  arrUsd?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  geography?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  raiseTargetUsd?: number;

  @ApiPropertyOptional({ description: 'Startup description used for thesis alignment scoring' })
  @IsOptional()
  @IsString()
  description?: string;
}

export class DiscoverySearchDto {
  @ApiPropertyOptional({ description: 'Text search on investor name/fund/thesis' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Investor type filter' })
  @IsOptional()
  @IsString()
  investorType?: string;

  @ApiPropertyOptional({ description: 'Stage focus filter (comma-separated)' })
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

  @ApiPropertyOptional({ description: 'Minimum composite score (0-100)', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  minScore?: number;

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
