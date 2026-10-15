'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { billingApi } from '@/lib/api';

interface Feature {
  id: string;
  key: string;
  name: string;
  description: string;
  category: string;
  creditCost: number;
  usageLimit: number | null;
  isBoolean: boolean;
}

interface PlanFeature {
  feature: Feature;
  isIncluded: boolean;
  customLimit: number | null;
  customCreditCost: number | null;
}

interface Subscription {
  id: string;
  planId: string;
  status: string;
  currentPeriodEnd: string;
  plan: {
    name: string;
    displayName: string;
    creditsPerMonth: number;
    contactLimit: number | null;
    teamSeats: number;
    features: PlanFeature[];
  };
}

interface CreditBalance {
  balance: number;
  lifetimeEarned: number;
  lifetimeSpent: number;
}

interface FeatureUsage {
  featureKey: string;
  usageCount: number;
  creditsSpent: number;
  usageLimit: number | null;
}

interface SubscriptionContextType {
  subscription: Subscription | null;
  creditBalance: CreditBalance | null;
  featureUsage: FeatureUsage[];
  loading: boolean;
  hasFeatureAccess: (featureKey: string) => boolean;
  hasCredits: (amount: number) => boolean;
  canUseFeature: (featureKey: string) => { allowed: boolean; reason?: string };
  refreshSubscription: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextType>({
  subscription: null,
  creditBalance: null,
  featureUsage: [],
  loading: true,
  hasFeatureAccess: () => false,
  hasCredits: () => false,
  canUseFeature: () => ({ allowed: false }),
  refreshSubscription: async () => {},
});

export const useSubscription = () => useContext(SubscriptionContext);

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [creditBalance, setCreditBalance] = useState<CreditBalance | null>(null);
  const [featureUsage, setFeatureUsage] = useState<FeatureUsage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSubscriptionData();
  }, []);

  const loadSubscriptionData = async () => {
    try {
      const [subscription, creditBalance, usageData] = await Promise.all([
        billingApi.getCurrentSubscription(),
        billingApi.getCreditBalance(),
        billingApi.getUsage()
      ]);
      
      setSubscription(subscription);
      setCreditBalance(creditBalance);
      setFeatureUsage(usageData.featureUsage || []);
    } catch (error) {
      console.error('Failed to load subscription data:', error);
    } finally {
      setLoading(false);
    }
  };

  const hasFeatureAccess = (featureKey: string): boolean => {
    if (!subscription) return false;
    
    const planFeature = subscription.plan.features.find(
      pf => pf.feature.key === featureKey
    );
    
    return planFeature?.isIncluded || false;
  };

  const hasCredits = (amount: number): boolean => {
    return (creditBalance?.balance || 0) >= amount;
  };

  const canUseFeature = (featureKey: string): { allowed: boolean; reason?: string } => {
    // Check if feature is included in plan
    if (!hasFeatureAccess(featureKey)) {
      return { 
        allowed: false, 
        reason: subscription ? 'Feature not included in your plan' : 'Please subscribe to use this feature'
      };
    }

    const planFeature = subscription!.plan.features.find(pf => pf.feature.key === featureKey);
    if (!planFeature) return { allowed: false, reason: 'Feature not found' };

    const feature = planFeature.feature;
    const creditCost = planFeature.customCreditCost ?? feature.creditCost;
    
    // Check credit requirements
    if (creditCost > 0 && !hasCredits(creditCost)) {
      return { allowed: false, reason: `Requires ${creditCost} credits. Purchase more credits to continue.` };
    }

    // Check usage limits
    const usageLimit = planFeature.customLimit ?? feature.usageLimit;
    if (usageLimit !== null) {
      const usage = featureUsage.find(u => u.featureKey === featureKey);
      if (usage && usage.usageCount >= usageLimit) {
        return { allowed: false, reason: `Monthly limit of ${usageLimit} uses reached. Upgrade your plan for more.` };
      }
    }

    return { allowed: true };
  };

  return (
    <SubscriptionContext.Provider
      value={{
        subscription,
        creditBalance,
        featureUsage,
        loading,
        hasFeatureAccess,
        hasCredits,
        canUseFeature,
        refreshSubscription: loadSubscriptionData,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}