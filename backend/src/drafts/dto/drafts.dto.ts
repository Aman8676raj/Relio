import { IsString, IsOptional, IsUUID, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GenerateDraftDto {
  @ApiProperty({ description: 'Contact ID to generate draft for' })
  @IsUUID()
  contact_id: string;
}

export class SendDraftDto {
  @ApiProperty({ description: 'Email body text to send' })
  @IsString()
  text: string;

  @ApiPropertyOptional({ description: 'Email subject line' })
  @IsOptional()
  @IsString()
  subject?: string;
}

export class DraftFeedbackDto {
  @ApiProperty({ enum: ['positive', 'negative'] })
  @IsIn(['positive', 'negative'])
  feedback: 'positive' | 'negative';
}
