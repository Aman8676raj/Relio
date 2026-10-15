import {
  IsString,
  IsNotEmpty,
  IsInt,
  IsOptional,
  IsEnum,
  MinLength,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export type FeatureCategory = 'retention' | 'acquisition' | 'revenue' | 'moat' | 'dx';
export type FeatureVerdict = 'build' | 'defer' | 'kill' | 'needs-validation';

export class CreateAnalysisDto {
  @ApiProperty({ example: 'AI-powered email reply suggestions' })
  @IsString()
  @IsNotEmpty()
  featureName: string;

  @ApiProperty({
    example:
      'When a founder views an investor thread, the system generates a draft reply surfacing context from prior conversations, their portfolio thesis, and the current stage of the deal. The draft is editable before sending.',
    minLength: 50,
  })
  @IsString()
  @MinLength(50)
  featureDescription: string;

  @ApiProperty({ enum: ['retention', 'acquisition', 'revenue', 'moat', 'dx'] })
  @IsEnum(['retention', 'acquisition', 'revenue', 'moat', 'dx'])
  featureCategory: FeatureCategory;

  @ApiPropertyOptional({ example: 14, description: 'Estimated build time in days (1-365)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  @Transform(({ value }) => (value !== undefined ? Number(value) : value))
  estimatedBuildDays?: number;
}
