import { Controller, Get, Post, Body, Headers, HttpCode, UseGuards, BadRequestException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { Public } from '../auth/public.decorator';
import { BillingService } from './billing.service';

interface CreateSubscriptionDto {
  planId: string;
  billingCycle: 'monthly' | 'yearly';
}

interface PurchaseCreditsDto {
  amount: number;
  paymentMethodId: string;
}

@Controller('billing')
export class BillingController {
  constructor(private billingService: BillingService) {}

  @Public()
  @Get('plans')
  async getPlans() {
    return this.billingService.getPlans();
  }

  @Post('subscribe')
  @UseGuards(JwtAuthGuard)
  async createSubscription(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateSubscriptionDto
  ) {
    return this.billingService.createSubscription(userId, dto.planId, dto.billingCycle);
  }

  @Get('subscription')
  @UseGuards(JwtAuthGuard)
  async getCurrentSubscription(@CurrentUser('id') userId: string) {
    return this.billingService.getCurrentSubscription(userId);
  }

  @Get('usage')
  @UseGuards(JwtAuthGuard)
  async getUsageStats(@CurrentUser('id') userId: string) {
    return this.billingService.getUsageStats(userId);
  }

  @Get('credits')
  @UseGuards(JwtAuthGuard)
  async getCreditBalance(@CurrentUser('id') userId: string) {
    return this.billingService.getCreditBalance(userId);
  }

  @Post('credits/purchase')
  @UseGuards(JwtAuthGuard)
  async purchaseCredits(
    @CurrentUser('id') userId: string,
    @Body() dto: PurchaseCreditsDto
  ) {
    return this.billingService.purchaseCredits(userId, dto.amount, dto.paymentMethodId);
  }

  @Post('webhook')
  @HttpCode(200)
  async handleWebhook(
    @Headers('stripe-signature') signature: string,
    @Body() payload: Buffer
  ) {
    try {
      await this.billingService.handleWebhook(signature, payload);
      return { received: true };
    } catch (error) {
      throw new BadRequestException('Webhook signature verification failed');
    }
  }
}