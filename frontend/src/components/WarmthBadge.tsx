'use client';

import type { WarmthTier } from '@/lib/types';

const TIER_CONFIG: Record<WarmthTier, { label: string; dotColor: string; className: string }> = {
  hot: { label: 'Hot', dotColor: '#B33A27', className: 'warmth-hot' },
  warm: { label: 'Warm', dotColor: '#A86B14', className: 'warmth-warm' },
  cold: { label: 'Cold', dotColor: '#2C5B6B', className: 'warmth-cold' },
  frozen: { label: 'Frozen', dotColor: '#8A8078', className: 'warmth-frozen' },
};

export function WarmthBadge({ tier, size = 'sm' }: { tier: WarmthTier; size?: 'sm' | 'md' }) {
  const config = TIER_CONFIG[tier];
  return (
    <span
      data-testid={`warmth-badge-${tier}`}
      className={`inline-flex items-center gap-1.5 font-semibold ${config.className}`}
      style={{
        padding: size === 'md' ? '5px 12px' : '3px 10px',
        fontSize: size === 'md' ? '12px' : '11px',
        borderRadius: 10,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        fontFamily: 'var(--font-heading)',
      }}
    >
      <span
        className="shrink-0 rounded-full"
        style={{ width: 6, height: 6, backgroundColor: config.dotColor }}
      />
      {config.label}
    </span>
  );
}
