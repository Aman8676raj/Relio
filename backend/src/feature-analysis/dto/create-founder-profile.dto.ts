import {
  IsString,
  IsNotEmpty,
  IsInt,
  IsOptional,
  IsUrl,
  Min,
  IsEnum,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class CreateFounderProfileDto {
  @ApiProperty({ example: 'Relio' })
  @IsString()
  @IsNotEmpty()
  appName: string;

  @ApiProperty({ example: 'AI-powered CRM for founders managing investor outreach.' })
  @IsString()
  @MinLength(20)
  appDescription: string;

  @ApiProperty({ example: 'Early-stage B2B SaaS founders in the US' })
  @IsString()
  @IsNotEmpty()
  targetMarket: string;

  @ApiProperty({ example: 12000, description: 'Current MRR in USD' })
  @IsInt()
  @Min(0)
  @Transform(({ value }) => Number(value))
  currentMRR: number;

  @ApiProperty({ enum: ['pre-seed', 'seed', 'series-a', 'series-b'] })
  @IsEnum(['pre-seed', 'seed', 'series-a', 'series-b'])
  stage: string;

  @ApiProperty({ example: 2000000, description: 'Fundraising goal in USD' })
  @IsInt()
  @Min(0)
  @Transform(({ value }) => Number(value))
  fundingGoal: number;

  @ApiPropertyOptional({ example: 'https://www.crunchbase.com/person/john-doe' })
  @IsOptional()
  @IsUrl()
  crunchbaseProfileUrl?: string;
}
