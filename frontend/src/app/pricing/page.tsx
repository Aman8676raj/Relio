'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { CheckCircle2, Crown, ArrowRight, Shield, Rocket, Users, Star, Loader2 } from 'lucide-react';
import { billingApi, onboardingApi } from '@/lib/api';
import type { Plan } from '@/lib/api';

export default function PricingPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState<string | null>(null);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const router = useRouter();

  useEffect(() => {
    billingApi.getPlans()
      .then(data => setPlans(data.plans))
      .catch(err => console.error('Failed to load plans:', err))
      .finally(() => setLoading(false));
  }, []);

  const handleSubscribe = async (planId: string) => {
    setSubscribing(planId);
    try {
      await billingApi.createSubscription(planId, billingCycle);
      await onboardingApi.markComplete();
      router.push('/dashboard?subscription=success');
    } catch (error) {
      console.error('Subscription failed:', error);
    } finally {
      setSubscribing(null);
    }
  };

  const getMonthlyPrice = (plan: Plan) => {
    if (billingCycle === 'yearly') return Math.floor(plan.priceYearly / 12);
    return plan.priceMonthly;
  };

  const formatPrice = (cents: number) => {
    if (cents === 0) return 'Free';
    return `$${Math.floor(cents / 100)}`;
  };

  const getSavings = (plan: Plan) => {
    if (!plan.priceYearly || !plan.priceMonthly) return 0;
    return Math.floor((plan.priceMonthly * 12 - plan.priceYearly) / 100);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--bg)' }}>
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--primary)' }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
      <div className="max-w-6xl mx-auto px-8 py-16">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-14"
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl mx-auto mb-6 clay-card">
            <Crown className="h-8 w-8" style={{ color: 'var(--primary)' }} />
          </div>
          <h1 className="text-4xl font-bold mb-3" style={{ color: 'var(--text)', fontFamily: 'var(--font-heading)' }}>
            Choose Your Plan
          </h1>
          <p className="text-lg max-w-xl mx-auto" style={{ color: 'var(--text-muted)' }}>
            Scale your investor relationships at every stage of your fundraise
          </p>
        </motion.div>

        {/* Billing Toggle */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="flex justify-center mb-12"
        >
          <div
            className="flex items-center gap-1 p-1 rounded-xl clay-card"
            style={{ backgroundColor: 'var(--surface)' }}
          >
            {(['monthly', 'yearly'] as const).map(cycle => (
              <button
                key={cycle}
                onClick={() => setBillingCycle(cycle)}
                className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all duration-200"
                style={{
                  backgroundColor: billingCycle === cycle ? 'var(--primary)' : 'transparent',
                  color: billingCycle === cycle ? 'white' : 'var(--text-muted)',
                }}
              >
                {cycle === 'monthly' ? 'Monthly' : 'Yearly'}
                {cycle === 'yearly' && (
                  <span
                    className="px-1.5 py-0.5 rounded-md text-[10px] font-bold"
                    style={{
                      backgroundColor: billingCycle === 'yearly' ? 'rgba(255,255,255,0.2)' : 'var(--success-bg)',
                      color: billingCycle === 'yearly' ? 'white' : 'var(--success)',
                    }}
                  >
                    −20%
                  </span>
                )}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Plans Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {plans.map((plan, index) => {
            const monthlyPrice = getMonthlyPrice(plan);
            const savings = getSavings(plan);
            const isSubscribing = subscribing === plan.id;

            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.15 + index * 0.08 }}
                whileHover={{ y: -4 }}
                className="clay-card p-6 relative flex flex-col"
                style={{
                  border: plan.isPopular
                    ? '2px solid var(--primary)'
                    : '1px solid var(--border)',
                }}
              >
                {plan.isPopular && (
                  <div
                    className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[11px] font-bold text-white flex items-center gap-1"
                    style={{ background: 'linear-gradient(135deg, var(--primary), var(--accent))' }}
                  >
                    <Star className="h-3 w-3" />
                    Most Popular
                  </div>
                )}

                {plan.isMostAdvanced && (
                  <div className="absolute top-5 right-5">
                    <Crown className="h-4 w-4" style={{ color: 'var(--accent)' }} />
                  </div>
                )}

                {/* Plan name & description */}
                <h3
                  className="text-lg font-bold mb-1"
                  style={{ color: 'var(--text)', fontFamily: 'var(--font-heading)' }}
                >
                  {plan.displayName}
                </h3>
                <p className="text-sm mb-5" style={{ color: 'var(--text-muted)' }}>
                  {plan.description}
                </p>

                {/* Price */}
                <div className="mb-5">
                  <div className="flex items-baseline gap-1">
                    <span
                      className="text-3xl font-extrabold"
                      style={{ color: 'var(--text)', fontFamily: 'var(--font-heading)' }}
                    >
                      {formatPrice(monthlyPrice)}
                    </span>
                    {monthlyPrice > 0 && (
                      <span className="text-sm" style={{ color: 'var(--text-muted)' }}>/mo</span>
                    )}
                  </div>
                  {billingCycle === 'yearly' && savings > 0 && (
                    <p className="text-xs mt-1 font-semibold" style={{ color: 'var(--success)' }}>
                      Save ${savings}/year
                    </p>
                  )}
                </div>

                {/* Limits */}
                <div
                  className="space-y-1.5 text-xs mb-5 pb-5"
                  style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}
                >
                  <div>{plan.contactLimit ? `${plan.contactLimit.toLocaleString()} contacts` : 'Unlimited contacts'}</div>
                  <div>{plan.teamSeats} team {plan.teamSeats === 1 ? 'seat' : 'seats'}</div>
                  <div>{plan.creditsPerMonth.toLocaleString()} AI credits/mo</div>
                </div>

                {/* Features */}
                <div className="space-y-2 mb-6 flex-1">
                  {plan.features.slice(0, 5).map((f) => (
                    <div key={f.feature.id} className="flex items-start gap-2 text-sm">
                      <CheckCircle2
                        className="h-3.5 w-3.5 shrink-0 mt-0.5"
                        style={{ color: 'var(--success)' }}
                      />
                      <span style={{ color: 'var(--text)' }}>{f.feature.name}</span>
                    </div>
                  ))}
                  {plan.features.length > 5 && (
                    <p className="text-xs pl-5" style={{ color: 'var(--text-muted)' }}>
                      +{plan.features.length - 5} more
                    </p>
                  )}
                </div>

                {/* CTA */}
                <button
                  onClick={() => handleSubscribe(plan.id)}
                  disabled={isSubscribing}
                  className="w-full py-3 rounded-xl text-sm font-bold transition-all disabled:opacity-60"
                  style={
                    plan.isPopular
                      ? { background: 'linear-gradient(135deg, var(--primary), var(--accent))', color: 'white' }
                      : { backgroundColor: 'var(--surface)', color: 'var(--text)', border: '1.5px solid var(--border-strong)' }
                  }
                >
                  {isSubscribing ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Processing...
                    </span>
                  ) : plan.priceMonthly === 0 ? (
                    'Start Free'
                  ) : (
                    <span className="flex items-center justify-center gap-1">
                      Get Started
                      <ArrowRight className="h-4 w-4" />
                    </span>
                  )}
                </button>
              </motion.div>
            );
          })}
        </div>

        {/* Trust row */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-2xl mx-auto text-center"
        >
          {[
            { icon: Shield, label: 'Bank-level security' },
            { icon: Rocket, label: 'Instant setup' },
            { icon: Users, label: '14-day free trial' },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center justify-center gap-2">
              <Icon className="h-4 w-4" style={{ color: 'var(--primary)' }} />
              <span className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>{label}</span>
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}
