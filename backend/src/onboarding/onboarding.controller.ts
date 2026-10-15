import { Controller, Get, Post, Body, Patch, Param, UseGuards, ValidationPipe, BadRequestException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { OnboardingService } from './onboarding.service';
import { IsNotEmpty, IsString, IsOptional, IsNumber, IsEnum } from 'class-validator';

class CompanyProfileDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNotEmpty()
  @IsEnum(['pre-seed', 'seed', 'series-a', 'series-b', 'series-c', 'growth'])
  stage: string;

  @IsNotEmpty()
  @IsString()
  sector: string;

  @IsOptional()
  @IsString()
  subSector?: string;

  @IsOptional()
  @IsNumber()
  arrUsd?: number;

  @IsOptional()
  @IsString()
  geography?: string;

  @IsOptional()
  @IsNumber()
  raiseTargetUsd?: number;
}

class StepUpdateDto {
  @IsOptional()
  stepData?: Record<string, any>;
}

@Controller('onboarding')
@UseGuards(JwtAuthGuard)
export class OnboardingController {
  constructor(private onboardingService: OnboardingService) {}

  @Get()
  async getProgress(@CurrentUser() user: any) {
    return this.onboardingService.getOnboardingProgress(user.id);
  }

  @Get('steps/:stepNumber')
  async getStep(@Param('stepNumber') stepNumber: string) {
    const step = this.onboardingService.getStepByNumber(parseInt(stepNumber));
    if (!step) {
      throw new BadRequestException('Invalid step number');
    }
    return step;
  }

  @Post('steps/:stepNumber/complete')
  async completeStep(
    @CurrentUser() user: any,
    @Param('stepNumber') stepNumber: string,
    @Body() dto: StepUpdateDto
  ) {
    const step = parseInt(stepNumber);
    return this.onboardingService.updateProgress(user.id, step, dto.stepData);
  }

  @Post('steps/:stepNumber/skip')
  async skipStep(
    @CurrentUser() user: any,
    @Param('stepNumber') stepNumber: string
  ) {
    const step = parseInt(stepNumber);
    return this.onboardingService.skipStep(user.id, step);
  }

  @Post('company-profile')
  async updateCompanyProfile(
    @CurrentUser() user: any,
    @Body(ValidationPipe) dto: CompanyProfileDto
  ) {
    // Update startup profile
    const profile = await this.onboardingService.updateCompanyProfile(user.id, dto);
    
    // Mark step 2 as completed
    await this.onboardingService.updateProgress(user.id, 2, { companyProfile: dto });
    
    return profile;
  }

  @Post('complete')
  async markComplete(@CurrentUser() user: any) {
    return this.onboardingService.markAsCompleted(user.id);
  }
}