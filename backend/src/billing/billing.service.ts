import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BillingService {
  constructor(private prisma: PrismaService) {}

  async getPlans() {
    const plans = await this.prisma.plan.findMany({
      where: { isActive: true },
      include: {
        features: {
          include: { feature: true },
          orderBy: { feature: { category: 'asc' } }
        }
      },
      orderBy: { sortOrder: 'asc' }
    });

    return { plans };
  }

  async getCurrentSubscription(userId: string) {
    // Get or create a default subscription for the user
    let subscription = await this.prisma.subscription.findFirst({
      where: { userId },
      include: {
        plan: {
          include: {
            features: {
              include: { feature: true }
            }
          }
        }
      }
    });

    // If no subscription exists, create a starter plan subscription
    if (!subscription) {
      const starterPlan = await this.prisma.plan.findFirst({
        where: { name: 'starter' },
        include: {
          features: {
            include: { feature: true }
          }
        }
      });

      if (starterPlan) {
        subscription = await this.prisma.subscription.upsert({
          where: { userId },
          update: {},
          create: {
            userId,
            planId: starterPlan.id,
            status: 'active',
            billingCycle: 'monthly',
            currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
          },
          include: {
            plan: {
              include: {
                features: {
                  include: { feature: true }
                }
              }
            }
          }
        });

        // Create initial credit balance
        await this.prisma.creditBalance.upsert({
          where: { userId },
          update: {},
          create: {
            userId,
            balance: starterPlan.creditsPerMonth,
            lifetimeEarned: starterPlan.creditsPerMonth,
            lifetimeSpent: 0
          }
        });
      }
    }

    return subscription;
  }

  async createSubscription(userId: string, planId: string, billingCycle: 'monthly' | 'yearly') {
    const plan = await this.prisma.plan.findUnique({ where: { id: planId } });
    
    if (!plan) {
      throw new BadRequestException('Invalid plan');
    }

    // For now, just update the user's subscription plan without Stripe
    const subscription = await this.prisma.subscription.upsert({
      where: { userId },
      update: {
        planId,
        billingCycle,
        status: 'active',
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
      create: {
        userId,
        planId,
        billingCycle,
        status: 'active',
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      }
    });

    // Update credit balance
    await this.prisma.creditBalance.upsert({
      where: { userId },
      update: {
        balance: plan.creditsPerMonth
      },
      create: {
        userId,
        balance: plan.creditsPerMonth,
        lifetimeEarned: plan.creditsPerMonth,
        lifetimeSpent: 0
      }
    });

    return subscription;
  }

  async getUsageStats(userId: string) {
    const featureUsage = await this.prisma.featureUsage.findMany({
      where: { userId },
      include: { feature: true }
    });

    return { featureUsage };
  }

  async getCreditBalance(userId: string) {
    let creditBalance = await this.prisma.creditBalance.findUnique({
      where: { userId }
    });

    // Create initial balance if it doesn't exist
    if (!creditBalance) {
      const subscription = await this.getCurrentSubscription(userId);
      const creditsPerMonth = subscription?.plan?.creditsPerMonth || 10;
      
      creditBalance = await this.prisma.creditBalance.upsert({
        where: { userId },
        update: {},
        create: {
          userId,
          balance: creditsPerMonth,
          lifetimeEarned: creditsPerMonth,
          lifetimeSpent: 0
        }
      });
    }

    return creditBalance;
  }

  async purchaseCredits(userId: string, amount: number, paymentMethodId: string) {
    // For now, just add credits without payment processing
    await this.prisma.creditBalance.update({
      where: { userId },
      data: {
        balance: { increment: amount },
        lifetimeEarned: { increment: amount }
      }
    });

    return { success: true, message: `Added ${amount} credits` };
  }

  async handleWebhook(signature: string, payload: Buffer) {
    // Webhook handling would go here
    return { received: true };
  }
}