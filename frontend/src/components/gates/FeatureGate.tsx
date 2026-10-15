'use client';

import { ReactNode } from 'react';
import { useSubscription } from '@/context/SubscriptionContext';
import { Crown, ArrowRight } from 'lucide-react';
import Link from 'next/link';

interface FeatureGateProps {
  featureKey: string;
  children: ReactNode;
  fallback?: ReactNode;
  showUpgrade?: boolean;
}

export default function FeatureGate({ 
  featureKey, 
  children, 
  fallback, 
  showUpgrade = true 
}: FeatureGateProps) {
  const { canUseFeature, subscription, loading } = useSubscription();

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  const access = canUseFeature(featureKey);
  
  if (access.allowed) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  if (!showUpgrade) {
    return null;
  }

  return <UpgradePrompt reason={access.reason} currentPlan={subscription?.plan.name} />;
}

function UpgradePrompt({ reason, currentPlan }: { reason?: string; currentPlan?: string }) {
  const getRecommendedPlan = () => {
    switch (currentPlan) {
      case 'starter': return { plan: 'Growth', price: '$49', href: '/pricing' };
      case 'growth': return { plan: 'Scale', price: '$99', href: '/pricing' };
      default: return { plan: 'Growth', price: '$49', href: '/pricing' };
    }
  };

  const recommended = getRecommendedPlan();

  return (
    <div className="clay-card p-6 text-center max-w-md mx-auto">
      <div className="flex items-center justify-center mb-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl"
          style={{ background: 'linear-gradient(135deg, var(--accent), #8B5CF6)' }}>
          <Crown className="h-6 w-6 text-white" />
        </div>
      </div>
      
      <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--text)', fontFamily: 'var(--font-heading)' }}>
        Upgrade Required
      </h3>
      
      <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
        {reason || 'This feature is not included in your current plan.'}
      </p>
      
      <div className="flex items-center justify-center gap-2 mb-4 text-sm">
        <span style={{ color: 'var(--text-muted)' }}>Recommended:</span>
        <span className="font-bold" style={{ color: 'var(--text)' }}>{recommended.plan}</span>
        <span className="px-2 py-1 rounded-full text-xs font-bold" style={{ backgroundColor: 'var(--success-bg)', color: 'var(--success)' }}>
          {recommended.price}/month
        </span>
      </div>
      
      <Link href={recommended.href}>
        <button className="w-full py-3 rounded-xl text-sm font-bold text-white transition-all duration-200"
          style={{ background: 'linear-gradient(135deg, var(--primary), var(--accent))' }}>
          Upgrade Now <ArrowRight className="inline h-4 w-4 ml-1" />
        </button>
      </Link>
    </div>
  );
}