import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface OnboardingStep {
  step: number;
  title: string;
  description: string;
  component: string;
  isRequired: boolean;
  estimatedTime: number; // seconds
}

@Injectable()
export class OnboardingService {
  private readonly steps: OnboardingStep[] = [
    {
      step: 1,
      title: "Welcome to Founder CRM",
      description: "Let's get you set up in under 5 minutes",
      component: "Welcome",
      isRequired: true,
      estimatedTime: 30
    },
    {
      step: 2,
      title: "Company Profile",
      description: "Tell us about your startup for AI-powered matching",
      component: "CompanyProfile",
      isRequired: true,
      estimatedTime: 120
    },
    {
      step: 3,
      title: "Find Your Investors",
      description: "See AI-matched investors based on your profile",
      component: "InvestorMatching",
      isRequired: false,
      estimatedTime: 180
    },
    {
      step: 4,
      title: "Import Contacts",
      description: "Connect email to find warm intro paths",
      component: "ContactImport",
      isRequired: false,
      estimatedTime: 120
    },
    {
      step: 5,
      title: "Your Action Plan",
      description: "Get personalized next steps for fundraising success",
      component: "ActionPlan",
      isRequired: true,
      estimatedTime: 60
    }
  ];

  constructor(private prisma: PrismaService) {}

  async getOnboardingProgress(userId: string) {
    let progress = await this.prisma.onboardingProgress.findUnique({
      where: { userId }
    });

    if (!progress) {
      progress = await this.prisma.onboardingProgress.create({
        data: { userId }
      });
    }

    return {
      ...progress,
      steps: this.steps,
      totalSteps: this.steps.length
    };
  }

  async updateProgress(userId: string, step: number, stepData?: Record<string, any>) {
    const progress = await this.prisma.onboardingProgress.findUnique({
      where: { userId }
    });

    if (!progress) return null;

    const completedSteps = Array.isArray(progress.completedSteps) ? progress.completedSteps.filter(s => typeof s === 'number') : [];
    const updatedSteps = [...new Set([...completedSteps, step])].sort((a, b) => a - b);
    
    const updateData: any = {
      currentStep: Math.max(step + 1, progress.currentStep),
      completedSteps: updatedSteps
    };

    // Update specific step completion flags
    if (step === 2) updateData.companyProfileCompleted = true;
    if (step === 3) updateData.investorMatchingViewed = true;
    if (step === 4) updateData.contactsImported = true;
    if (step === 5) updateData.firstActionTaken = true;

    // Check if onboarding is complete
    if (updatedSteps.length === this.steps.length || step === 5) {
      updateData.isCompleted = true;
      updateData.completedAt = new Date();
      updateData.timeToComplete = Math.floor(
        (new Date().getTime() - progress.startedAt.getTime()) / 1000
      );
    }

    return this.prisma.onboardingProgress.update({
      where: { userId },
      data: updateData
    });
  }

  async updateCompanyProfile(userId: string, profileData: any) {
    // Update the startup profile
    const profile = await this.prisma.startupProfile.upsert({
      where: { userId },
      create: {
        userId,
        ...profileData
      },
      update: profileData
    });

    return profile;
  }

  async skipStep(userId: string, step: number) {
    const progress = await this.prisma.onboardingProgress.findUnique({
      where: { userId }
    });

    if (!progress) return null;

    const skippedSteps = Array.isArray(progress.stepsSkipped) ? progress.stepsSkipped : [];
    
    return this.prisma.onboardingProgress.update({
      where: { userId },
      data: {
        currentStep: step + 1,
        stepsSkipped: [...skippedSteps, step]
      }
    });
  }

  async markAsCompleted(userId: string) {
    return this.prisma.onboardingProgress.update({
      where: { userId },
      data: {
        isCompleted: true,
        completedAt: new Date()
      }
    });
  }

  getStepByNumber(stepNumber: number): OnboardingStep | null {
    return this.steps.find(step => step.step === stepNumber) || null;
  }
}