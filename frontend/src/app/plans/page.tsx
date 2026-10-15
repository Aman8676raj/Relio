'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSubscription } from '@/context/SubscriptionContext';
import { billingApi } from '@/lib/api';
import { CheckCircle2, Crown, Zap, Users, BarChart3, ShieldCheck, ArrowLeft, Loader2 } from 'lucide-react';

interface Plan {
  id: string;
  name: string;
  displayName: string;
  description: string;
  priceMonthly: number;
  priceYearly: number;
  contactLimit: number | null;
  teamSeats: number;
  creditsPerMonth: number;
  isPopular: boolean;
  isMostAdvanced: boolean;
  features: Array<{
    key: string;
    name: string;
    description: string;
    category: string;
    isIncluded: boolean;
  }>;
}

export default function PlansPage() {
  const router = useRouter();
  const { subscription, refreshSubscription } = useSubscription();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [upgrading, setUpgrading] = useState<string | null>(null);

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      const data = await billingApi.getPlans();
      setPlans(data.plans);
    } catch (error) {
      console.error('Failed to fetch plans:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async (planId: string) => {
    setUpgrading(planId);
    try {
      await billingApi.createSubscription(planId, billingCycle);
      await refreshSubscription();
      router.push('/settings');
    } catch (error) {
      console.error('Upgrade error:', error);
    } finally {
      setUpgrading(null);
    }
  };

  const formatPrice = (price: number) => (price / 100).toFixed(0);

  const getPlanFeatures = (plan: Plan) => {
    const categoryIcons = {
      core: CheckCircle2,
      ai: Zap,
      collaboration: Users,
      analytics: BarChart3,
      enterprise: ShieldCheck,
    };

    const grouped = plan.features.reduce((acc, feature) => {
      if (!acc[feature.category]) {
        acc[feature.category] = [];
      }
      acc[feature.category].push(feature);
      return acc;
    }, {} as Record<string, typeof plan.features>);

    return Object.entries(grouped).map(([category, features]) => {
      const Icon = categoryIcons[category as keyof typeof categoryIcons] || CheckCircle2;
      return (
        <div key={category}>
          <div className="flex items-center gap-2 mb-2">
            <Icon className="h-4 w-4" style={{ color: 'var(--primary)' }} />
            <span className="text-[12px] font-bold uppercase tracking-wider" style={{ color: 'var(--text)', fontFamily: 'var(--font-heading)' }}>
              {category}
            </span>
          </div>
          <div className="space-y-1 mb-4">
            {features.map(feature => (
              <div key={feature.key} className="flex items-center gap-2">
                <CheckCircle2 className="h-3 w-3 shrink-0" style={{ color: 'var(--success)' }} />
                <span className="text-[13px]" style={{ color: 'var(--text-muted)' }}>{feature.name}</span>
              </div>
            ))}
          </div>
        </div>
      );
    });
  };

  const isCurrentPlan = (planName: string) => {
    return subscription?.plan?.name === planName;
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--primary)' }} />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="text-center mb-12">
        <button 
          onClick={() => router.back()}
          className="flex items-center gap-2 mb-6 clay-btn clay-btn-sm"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Settings
        </button>
        
        <h1 className="text-[32px] font-bold mb-3" style={{ color: 'var(--text)', fontFamily: 'var(--font-heading)' }}>
          Choose Your Plan
        </h1>
        <p className="text-[16px] max-w-2xl mx-auto" style={{ color: 'var(--text-muted)' }}>
          Scale your investor relationships with features designed for every stage of your fundraising journey
        </p>

        {/* Billing Toggle */}
        <div className="flex items-center justify-center gap-4 mt-8 mb-2">
          <span className={`text-[14px] font-semibold ${billingCycle === 'monthly' ? 'text-black' : 'text-gray-500'}`}>
            Monthly
          </span>
          <button
            onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'yearly' : 'monthly')}
            className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
            style={{ backgroundColor: billingCycle === 'yearly' ? 'var(--primary)' : 'var(--border-strong)' }}
          >
            <span className="inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform"
              style={{ transform: billingCycle === 'yearly' ? 'translateX(24px)' : 'translateX(4px)' }} />
          </button>
          <div className="flex items-center gap-2">
            <span className={`text-[14px] font-semibold ${billingCycle === 'yearly' ? 'text-black' : 'text-gray-500'}`}>
              Yearly
            </span>
            <span className="text-[12px] font-bold px-2 py-1 rounded-full" style={{ background: 'var(--success-bg)', color: 'var(--success)' }}>
              Save 20%
            </span>
          </div>
        </div>
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {plans.map((plan) => {
          const price = billingCycle === 'yearly' ? plan.priceYearly : plan.priceMonthly;
          const monthlyPrice = billingCycle === 'yearly' ? plan.priceYearly / 12 : plan.priceMonthly;
          const isCurrent = isCurrentPlan(plan.name);
          const isUpgrading = upgrading === plan.id;

          return (
            <div
              key={plan.id}
              className={`clay-card relative overflow-hidden ${plan.isPopular ? 'ring-2' : ''}`}
              style={{ 
                borderRadius: 24,
                ringColor: plan.isPopular ? 'var(--primary)' : undefined,
                transform: plan.isPopular ? 'scale(1.05)' : 'scale(1)'
              }}
            >
              {plan.isPopular && (
                <div className="absolute top-0 left-0 right-0 text-center py-2 text-[12px] font-bold text-white"
                  style={{ background: 'linear-gradient(135deg, var(--primary), var(--accent))' }}>
                  Most Popular
                </div>
              )}

              {plan.isMostAdvanced && (
                <div className="absolute top-4 right-4">
                  <Crown className="h-5 w-5" style={{ color: 'var(--primary)' }} />
                </div>
              )}

              <div className={`p-6 ${plan.isPopular ? 'pt-12' : ''}`}>
                {/* Plan Header */}
                <div className="text-center mb-6">
                  <h3 className="text-[20px] font-bold mb-1" style={{ color: 'var(--text)', fontFamily: 'var(--font-heading)' }}>
                    {plan.displayName}
                  </h3>
                  <p className="text-[13px] mb-4" style={{ color: 'var(--text-muted)' }}>
                    {plan.description}
                  </p>
                  
                  <div className="mb-4">
                    <span className="text-[36px] font-bold" style={{ color: 'var(--text)', fontFamily: 'var(--font-heading)' }}>
                      ${formatPrice(monthlyPrice)}
                    </span>
                    <span className="text-[14px]" style={{ color: 'var(--text-muted)' }}>/month</span>
                    {billingCycle === 'yearly' && price > 0 && (
                      <div className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
                        Billed ${formatPrice(price)} annually
                      </div>
                    )}
                  </div>

                  {/* Plan Stats */}
                  <div className="space-y-2 text-[13px]" style={{ color: 'var(--text-muted)' }}>
                    <div>{plan.contactLimit ? `${plan.contactLimit} contacts` : 'Unlimited contacts'}</div>
                    <div>{plan.teamSeats} team {plan.teamSeats === 1 ? 'seat' : 'seats'}</div>
                    <div>{plan.creditsPerMonth} AI credits/month</div>
                  </div>
                </div>

                {/* Action Button */}
                <div className="mb-6">
                  {isCurrent ? (
                    <button className="w-full py-3 rounded-xl text-[14px] font-bold"
                      style={{ background: 'var(--success-bg)', color: 'var(--success)' }}>
                      Current Plan
                    </button>
                  ) : (
                    <button
                      onClick={() => handleUpgrade(plan.id)}
                      disabled={isUpgrading}
                      className="w-full py-3 rounded-xl text-[14px] font-bold transition-all clay-btn"
                      style={{ 
                        opacity: isUpgrading ? 0.7 : 1,
                        cursor: isUpgrading ? 'wait' : 'pointer'
                      }}
                    >
                      {isUpgrading ? (
                        <div className="flex items-center justify-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Upgrading...
                        </div>
                      ) : (
                        plan.priceMonthly === 0 ? 'Get Started' : 'Upgrade'
                      )}
                    </button>
                  )}
                </div>

                {/* Features */}
                <div className="space-y-4">
                  {getPlanFeatures(plan)}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* FAQ Section */}
      <div className="mt-16 text-center">
        <h2 className="text-[24px] font-bold mb-6" style={{ color: 'var(--text)', fontFamily: 'var(--font-heading)' }}>
          Questions? We're here to help
        </h2>
        <p className="text-[14px]" style={{ color: 'var(--text-muted)' }}>
          Contact us at support@relio.ai or book a demo to see how Relio can transform your fundraising
        </p>
      </div>
    </div>
  );
}