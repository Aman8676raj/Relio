'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { dashboardApi, digestApi, contactsApi, pipelineVelocityApi, heatmapApi, onboardingApi, type PulseResponse, type PriorityAction, type ReportMetric, type DashboardDigestResponse, type ContactResponse } from '@/lib/api';
import { WarmthBadge } from '@/components/WarmthBadge';
import {
  TrendingUp, TrendingDown, Ghost, MessageSquare,
  Sparkles, Send, AlertTriangle, Eye, ArrowRight,
  Flame, Snowflake, ThermometerSun, Zap, CalendarClock,
  ChevronRight, Clock, Trophy, Target, Timer, AlertCircle,
} from 'lucide-react';
import type { WarmthTier } from '@/lib/types';
import Link from 'next/link';

function Skeleton({ className }: { className?: string }) {
  return <div className={`skeleton ${className || ''}`} />;
}

function timeAgo(d: string | null): string {
  if (!d) return 'Never';
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

// ─── Momentum Arc ────────────────────────────────────────────────────────────

function MomentumArc({ score, delta }: { score: number; delta: number }) {
  const radius = 58;
  const stroke = 8;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (score / 100) * circumference * 0.75;
  const color = score >= 70 ? 'var(--success)' : score >= 40 ? 'var(--accent)' : 'var(--danger)';

  return (
    <div className="relative flex items-center justify-center" style={{ width: 144, height: 144 }}>
      <svg width="144" height="144" viewBox="0 0 144 144" className="transform -rotate-[135deg]">
        <circle cx="72" cy="72" r={radius} fill="none" stroke="var(--border)" strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={`${circumference * 0.75} ${circumference * 0.25}`} />
        <circle cx="72" cy="72" r={radius} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={`${circumference * 0.75} ${circumference * 0.25}`}
          strokeDashoffset={dashOffset}
          style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.22,1,0.36,1)' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[2.8rem] font-extrabold leading-none tabular-nums" style={{ color, fontFamily: 'var(--font-heading)' }}>{score}</span>
        <span className="flex items-center gap-1 mt-1 text-[12px] font-bold" style={{ color: delta >= 0 ? 'var(--success)' : 'var(--danger)' }}>
          {delta >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {delta > 0 ? '+' : ''}{delta}
        </span>
      </div>
    </div>
  );
}

// ─── Stat Tile ───────────────────────────────────────────────────────────────

function StatTile({ icon: Icon, value, label, color, bgColor, subtitle }: {
  icon: typeof Flame; value: number | string; label: string; color: string; bgColor: string; subtitle?: string;
}) {
  return (
    <div className="rounded-2xl p-4 flex items-center gap-3 transition-all duration-200 group cursor-default"
      style={{ backgroundColor: bgColor }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; }}>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)` }}>
        <Icon className="h-5 w-5" style={{ color }} />
      </div>
      <div>
        <p className="text-2xl font-extrabold tabular-nums leading-none" style={{ color: 'var(--text)', fontFamily: 'var(--font-heading)' }}>{value}</p>
        <p className="text-[11px] font-semibold mt-1 uppercase tracking-wider" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-heading)' }}>{label}</p>
        {subtitle && <p className="text-[10px] mt-0.5" style={{ color }}>{subtitle}</p>}
      </div>
    </div>
  );
}

// ─── Focus Card ──────────────────────────────────────────────────────────────

const ACTION_ICONS: Record<string, typeof Send> = { follow_up: Send, at_risk: AlertTriangle, stalled_pipeline: Eye };
const ACTION_ACCENT: Record<string, string> = { follow_up: 'var(--primary)', at_risk: 'var(--danger)', stalled_pipeline: 'var(--accent)' };

function FocusCard({ action }: { action: PriorityAction }) {
  const Icon = ACTION_ICONS[action.type] || Send;
  const accent = ACTION_ACCENT[action.type] || 'var(--primary)';
  const contact = action.contact;
  const initials = contact.name ? contact.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : contact.email[0].toUpperCase();

  return (
    <div data-testid={`focus-card-${contact.id}`}
      className="group relative rounded-2xl p-5 transition-all duration-300 cursor-pointer overflow-hidden"
      style={{ backgroundColor: 'var(--surface)', boxShadow: 'var(--shadow-clay-sm)', border: '1px solid rgba(255,255,255,0.5)' }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-clay-hover)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-clay-sm)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; }}>
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-[14px] font-bold text-white border-2 border-white"
          style={{ background: `linear-gradient(135deg, ${accent}, color-mix(in srgb, ${accent} 70%, #000))`, boxShadow: `0 4px 12px color-mix(in srgb, ${accent} 25%, transparent)` }}>
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-[15px] font-bold truncate" style={{ color: 'var(--text)', fontFamily: 'var(--font-heading)' }}>{contact.name || contact.email}</p>
            <WarmthBadge tier={contact.warmthTier as WarmthTier} />
          </div>
          <p className="text-[12px] mb-0.5" style={{ color: 'var(--text-muted)' }}>{contact.company}</p>
          <div className="flex items-center gap-1.5 mt-2">
            <Icon className="h-3.5 w-3.5" style={{ color: accent }} />
            <p className="text-[13px] font-medium" style={{ color: accent }}>{action.reason}</p>
          </div>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between">
        <span className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>Last contact: {timeAgo(contact.lastContactedAt)} ago</span>
        <button className="clay-btn clay-btn-sm text-[12px] flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all duration-300"
          style={{ background: accent, boxShadow: `inset 0 -3px 6px rgba(0,0,0,0.15), 0 4px 12px color-mix(in srgb, ${accent} 25%, transparent)` }}>
          {action.ctaLabel} <ArrowRight className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

// ─── Tier Ring ───────────────────────────────────────────────────────────────

function TierRing({ pulse }: { pulse: PulseResponse }) {
  const tiers = [
    { key: 'hot' as const, label: 'Hot', color: 'var(--hot-text)', icon: Flame },
    { key: 'warm' as const, label: 'Warm', color: 'var(--warm-text)', icon: ThermometerSun },
    { key: 'cold' as const, label: 'Cold', color: 'var(--cold-text)', icon: Snowflake },
    { key: 'frozen' as const, label: 'Frozen', color: 'var(--frozen-text)', icon: Snowflake },
  ];
  const total = Object.values(pulse.tierBreakdown).reduce((s, b) => s + b.count, 0);
  const radius = 48; const stroke = 9; const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="flex items-center gap-5">
      <div className="relative shrink-0" style={{ width: 112, height: 112 }}>
        <svg width="112" height="112" viewBox="0 0 112 112" className="transform -rotate-90">
          {tiers.map(tier => {
            const count = pulse.tierBreakdown[tier.key].count;
            if (!count || !total) return null;
            const segLen = (count / total) * circumference; const gap = 4;
            const el = <circle key={tier.key} cx="56" cy="56" r={radius} fill="none" stroke={tier.color} strokeWidth={stroke} strokeLinecap="round"
              strokeDasharray={`${Math.max(0, segLen - gap)} ${circumference - segLen + gap}`} strokeDashoffset={-offset} style={{ transition: 'all 0.8s ease' }} />;
            offset += segLen; return el;
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-extrabold" style={{ color: 'var(--text)', fontFamily: 'var(--font-heading)' }}>{total}</span>
          <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>total</span>
        </div>
      </div>
      <div className="space-y-1.5 flex-1">
        {tiers.map(tier => {
          const bucket = pulse.tierBreakdown[tier.key];
          return (
            <Link key={tier.key} href={`/contacts?tier=${tier.key}`} data-testid={`tier-ring-${tier.key}`}
              className="flex items-center justify-between py-1 rounded-lg px-2 transition-colors group"
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: tier.color }} />
                <span className="text-[13px] font-semibold" style={{ color: 'var(--text)' }}>{tier.label}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[15px] font-bold tabular-nums" style={{ color: 'var(--text)', fontFamily: 'var(--font-heading)' }}>{bucket.count}</span>
                {bucket.overdueTouch > 0 && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'var(--danger-bg)', color: 'var(--danger)' }}>{bucket.overdueTouch}</span>}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// ─── Pipeline Velocity ───────────────────────────────────────────────────────

interface VelocityData {
  stages: { stage: string; label: string; avgDays: number; contacts: number; color: string }[];
  stuckContacts: { id: string; name: string; company: string; stage: string; daysInStage: number; avgForStage: number }[];
  totalAvgDays: number;
  closedAvgDays: number;
}

function PipelineVelocity({ velocity }: { velocity: VelocityData | null }) {
  if (!velocity) return <Skeleton className="h-48 rounded-3xl" />;
  const maxDays = Math.max(...velocity.stages.map(s => s.avgDays));

  return (
    <div data-testid="pipeline-velocity" className="clay-card p-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Timer className="h-4 w-4" style={{ color: 'var(--accent)' }} />
          <h2 className="text-[13px] font-bold tracking-[0.15em] uppercase" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-heading)' }}>Pipeline Velocity</h2>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[12px]" style={{ color: 'var(--text-muted)' }}>Avg close:</span>
          <span className="text-[16px] font-extrabold tabular-nums" style={{ color: 'var(--text)', fontFamily: 'var(--font-heading)' }}>{velocity.closedAvgDays}d</span>
        </div>
      </div>

      {/* Stage bars */}
      <div className="space-y-3 mb-5">
        {velocity.stages.map(s => (
          <div key={s.stage} className="flex items-center gap-3">
            <span className="text-[12px] font-semibold w-24 shrink-0 text-right" style={{ color: 'var(--text-muted)' }}>{s.label}</span>
            <div className="flex-1 h-7 rounded-xl overflow-hidden relative" style={{ backgroundColor: 'var(--bg)' }}>
              <div className="h-full rounded-xl flex items-center justify-end pr-3 transition-all duration-700"
                style={{ width: `${Math.max(20, (s.avgDays / maxDays) * 100)}%`, backgroundColor: s.color, opacity: 0.85 }}>
                <span className="text-[11px] font-bold text-white tabular-nums">{s.avgDays}d</span>
              </div>
            </div>
            <span className="text-[11px] font-medium w-8 shrink-0 tabular-nums" style={{ color: 'var(--text-muted)' }}>{s.contacts}</span>
          </div>
        ))}
      </div>

      {/* Stuck contacts */}
      {velocity.stuckContacts.length > 0 && (
        <div className="rounded-2xl p-4" style={{ backgroundColor: 'var(--warm-bg)', border: '1px solid rgba(224,154,54,0.15)' }}>
          <div className="flex items-center gap-1.5 mb-2">
            <AlertCircle className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
            <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--accent)', fontFamily: 'var(--font-heading)' }}>Stuck in Stage</span>
          </div>
          <div className="space-y-2">
            {velocity.stuckContacts.map(c => (
              <div key={c.id} className="flex items-center justify-between">
                <div>
                  <span className="text-[13px] font-semibold" style={{ color: 'var(--text)' }}>{c.name}</span>
                  <span className="text-[11px] ml-1.5" style={{ color: 'var(--text-muted)' }}>{c.company}</span>
                </div>
                <span className="text-[12px] font-bold tabular-nums" style={{ color: 'var(--danger)' }}>
                  {c.daysInStage}d <span className="font-normal" style={{ color: 'var(--text-muted)' }}>/ avg {c.avgForStage}d</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Activity Heatmap ────────────────────────────────────────────────────────

function ActivityHeatmap({ data }: { data: number[][] | null }) {
  if (!data) return <Skeleton className="h-28 rounded-3xl" />;
  const maxVal = Math.max(...data.flat());
  const dayLabels = ['M', '', 'W', '', 'F', '', ''];

  const getColor = (val: number) => {
    if (val === 0) return 'var(--bg)';
    const intensity = val / maxVal;
    if (intensity > 0.75) return 'var(--primary)';
    if (intensity > 0.5) return 'var(--accent)';
    if (intensity > 0.25) return 'var(--warm-bg)';
    return 'color-mix(in srgb, var(--warm-bg) 50%, var(--bg))';
  };

  const totalActivity = data.flat().reduce((s, v) => s + v, 0);

  return (
    <div data-testid="activity-heatmap" className="clay-card p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4" style={{ color: 'var(--primary)' }} />
          <h2 className="text-[13px] font-bold tracking-[0.15em] uppercase" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-heading)' }}>Activity</h2>
        </div>
        <span className="text-[12px] font-semibold" style={{ color: 'var(--text-muted)' }}>{totalActivity} interactions · 12 weeks</span>
      </div>
      <div className="flex gap-1">
        {/* Day labels */}
        <div className="flex flex-col gap-[3px] mr-1.5 pt-0.5">
          {dayLabels.map((d, i) => (
            <div key={i} className="h-[14px] flex items-center">
              <span className="text-[9px] font-medium" style={{ color: 'var(--text-muted)' }}>{d}</span>
            </div>
          ))}
        </div>
        {/* Grid */}
        {data.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-[3px]">
            {week.map((val, di) => (
              <div key={di} className="rounded-[3px] transition-colors cursor-default" title={`${val} interactions`}
                style={{ width: 14, height: 14, backgroundColor: getColor(val) }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1.3)'; (e.currentTarget as HTMLElement).style.zIndex = '10'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; (e.currentTarget as HTMLElement).style.zIndex = '0'; }} />
            ))}
          </div>
        ))}
      </div>
      {/* Legend */}
      <div className="flex items-center gap-2 mt-3 justify-end">
        <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>Less</span>
        {[0, 0.25, 0.5, 0.75, 1].map((v, i) => (
          <div key={i} className="rounded-[2px]" style={{ width: 10, height: 10, backgroundColor: getColor(v * maxVal) }} />
        ))}
        <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>More</span>
      </div>
    </div>
  );
}

// ─── Grade Badge ─────────────────────────────────────────────────────────────

function GradeBadge({ metric }: { metric: ReportMetric }) {
  const color = metric.grade.startsWith('A') ? 'var(--success)' : metric.grade.startsWith('B') ? 'var(--accent)' : 'var(--danger)';
  const bg = metric.grade.startsWith('A') ? 'var(--success-bg)' : metric.grade.startsWith('B') ? 'var(--warm-bg)' : 'var(--danger-bg)';
  return (
    <div className="flex items-center gap-3 rounded-2xl p-3 transition-all duration-200"
      style={{ backgroundColor: 'var(--surface)', boxShadow: 'var(--shadow-clay-sm)', border: '1px solid rgba(255,255,255,0.4)' }}>
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[18px] font-black"
        style={{ backgroundColor: bg, color, fontFamily: 'var(--font-heading)' }}>{metric.grade}</div>
      <div className="min-w-0">
        <p className="text-[13px] font-bold truncate" style={{ color: 'var(--text)' }}>{metric.name}</p>
        <p className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>{metric.note}</p>
      </div>
    </div>
  );
}

// ─── Activity Item ───────────────────────────────────────────────────────────

function ActivityItem({ contact, type }: { contact: ContactResponse; type: 'reply' | 'ghost' | 'moved' }) {
  const config = {
    reply: { icon: MessageSquare, color: 'var(--success)', bg: 'var(--success-bg)', label: 'replied' },
    ghost: { icon: Ghost, color: 'var(--danger)', bg: 'var(--danger-bg)', label: 'went silent' },
    moved: { icon: Zap, color: 'var(--accent)', bg: 'var(--warm-bg)', label: 'pipeline moved' },
  }[type];
  return (
    <div className="flex items-center gap-3 py-2.5">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: config.bg }}>
        <config.icon className="h-3.5 w-3.5" style={{ color: config.color }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px]" style={{ color: 'var(--text)' }}>
          <span className="font-semibold">{contact.name || contact.email.split('@')[0]}</span>
          {' '}<span style={{ color: 'var(--text-muted)' }}>{config.label}</span>
        </p>
      </div>
      <span className="text-[11px] shrink-0" style={{ color: 'var(--text-muted)' }}>{timeAgo(contact.lastContactedAt)}</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DASHBOARD PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [pulse, setPulse] = useState<PulseResponse | null>(null);
  const [actions, setActions] = useState<PriorityAction[] | null>(null);
  const [reportCard, setReportCard] = useState<{ metrics: ReportMetric[]; generatedAt: string } | null>(null);
  const [digest, setDigest] = useState<DashboardDigestResponse | null>(null);
  const [recentContacts, setRecentContacts] = useState<ContactResponse[]>([]);
  const [velocity, setVelocity] = useState<VelocityData | null>(null);
  const [heatmap, setHeatmap] = useState<number[][] | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);

  // Check onboarding status on page load
  useEffect(() => {
    const checkOnboarding = async () => {
      try {
        const progress = await onboardingApi.getProgress();
        
        // If onboarding is not completed, redirect to onboarding
        if (!progress.isCompleted) {
          router.push('/onboarding');
          return;
        }
      } catch (error) {
        console.error('Failed to check onboarding status:', error);
      } finally {
        setCheckingOnboarding(false);
      }
    };

    if (user) {
      checkOnboarding();
    }
  }, [user, router]);

  useEffect(() => {
    Promise.all([
      dashboardApi.pulse().then(setPulse),
      dashboardApi.actions().then(setActions),
      dashboardApi.reportCard().then(setReportCard),
      digestApi.dashboard().then(setDigest),
      contactsApi.list({ sort: 'last_contacted_desc', limit: '6' }).then(r => setRecentContacts(r.data)),
      pipelineVelocityApi.get().then(setVelocity),
      heatmapApi.get().then(setHeatmap),
    ]).finally(() => setLoading(false));
  }, []);

  const firstName = user?.name?.split(' ')[0] || 'Founder';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  // Show loading while checking onboarding or loading dashboard data
  if (checkingOnboarding || loading) {
    return (
      <div data-testid="dashboard-page" className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-[1200px] mx-auto space-y-6">
          <Skeleton className="h-12 w-80 rounded-2xl" />
          <div className="grid grid-cols-12 gap-5"><Skeleton className="col-span-4 h-48 rounded-3xl" /><Skeleton className="col-span-8 h-48 rounded-3xl" /></div>
          <div className="grid grid-cols-12 gap-5"><Skeleton className="col-span-7 h-64 rounded-3xl" /><Skeleton className="col-span-5 h-64 rounded-3xl" /></div>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="dashboard-page" className="flex-1 overflow-y-auto px-6 py-6">
      <div className="max-w-[1200px] mx-auto">

        {/* ─── Row 1: Hero ─── */}
        <div className="grid grid-cols-12 gap-5 mb-5 animate-fade-in">
          <div className="col-span-12 lg:col-span-5 clay-card p-6 flex items-center gap-6" data-testid="hero-momentum">
            <MomentumArc score={pulse?.momentum.score ?? 0} delta={pulse?.momentum.delta ?? 0} />
            <div>
              <h1 className="text-[1.75rem] font-extrabold tracking-tight leading-tight"
                style={{ color: 'var(--text)', fontFamily: 'var(--font-heading)', letterSpacing: '-0.02em' }}>
                {greeting},<br />{firstName}.
              </h1>
              <p className="text-[13px] mt-2" style={{ color: 'var(--text-muted)' }}>
                {pulse?.momentum.confidence === 'high' ? 'Your momentum is strong.' : pulse?.momentum.confidence === 'medium' ? 'Solid progress this week.' : 'Time to re-engage some contacts.'}
              </p>
              {digest && (digest.newReplies > 0 || digest.newSoftGhosts > 0) && (
                <div className="flex items-center gap-3 mt-3 flex-wrap">
                  {digest.newReplies > 0 && <span className="flex items-center gap-1 text-[12px] font-bold px-2.5 py-1 rounded-full" style={{ background: 'var(--success-bg)', color: 'var(--success)' }}><MessageSquare className="h-3 w-3" /> +{digest.newReplies} replies</span>}
                  {digest.newSoftGhosts > 0 && <span className="flex items-center gap-1 text-[12px] font-bold px-2.5 py-1 rounded-full" style={{ background: 'var(--danger-bg)', color: 'var(--danger)' }}><Ghost className="h-3 w-3" /> {digest.newSoftGhosts} ghosting</span>}
                </div>
              )}
            </div>
          </div>

          <div className="col-span-12 lg:col-span-7 clay-card p-5" data-testid="hero-stats">
            <div className="grid grid-cols-2 gap-3 h-full">
              <StatTile icon={MessageSquare} value={pulse?.momentum.activeConversations ?? 0} label="Active Threads" color="var(--primary)" bgColor="var(--hot-bg)" subtitle={`${pulse?.weeklyDelta.newReplies ?? 0} new this week`} />
              <StatTile icon={Ghost} value={pulse?.softGhosts.count ?? 0} label="Going Silent" color="var(--danger)" bgColor="var(--danger-bg)" subtitle={pulse?.softGhosts.count ? 'Need attention' : 'All clear'} />
              <StatTile icon={Target} value={`${pulse?.tierBreakdown.hot.count ?? 0}`} label="Hot Contacts" color="var(--success)" bgColor="var(--success-bg)" subtitle="Ready to close" />
              <StatTile icon={CalendarClock} value={`${(pulse?.tierBreakdown.warm.overdueTouch ?? 0) + (pulse?.tierBreakdown.cold.overdueTouch ?? 0)}`} label="Overdue Touch" color="var(--accent)" bgColor="var(--warm-bg)" subtitle="Schedule follow-ups" />
            </div>
          </div>
        </div>

        {/* ─── Row 2: Focus + Health ─── */}
        <div className="grid grid-cols-12 gap-5 mb-5 animate-fade-in stagger-2">
          <div className="col-span-12 lg:col-span-7" data-testid="todays-focus">
            <div className="flex items-center justify-between mb-4 px-1">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" style={{ color: 'var(--primary)' }} />
                <h2 className="text-[13px] font-bold tracking-[0.15em] uppercase" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-heading)' }}>Today's Focus</h2>
              </div>
              {actions && <span className="text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ background: 'var(--hot-bg)', color: 'var(--primary)', fontFamily: 'var(--font-heading)' }}>{actions.length} actions</span>}
            </div>
            <div className="space-y-3">
              {actions ? actions.map((a, i) => <FocusCard key={`${a.contact.id}-${i}`} action={a} />) : <>{[1, 2, 3].map(i => <Skeleton key={i} className="h-28 rounded-2xl" />)}</>}
            </div>
          </div>

          <div className="col-span-12 lg:col-span-5 space-y-5">
            <div className="clay-card p-6" data-testid="network-health">
              <h2 className="text-[13px] font-bold tracking-[0.15em] uppercase mb-4" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-heading)' }}>Network Health</h2>
              {pulse ? <TierRing pulse={pulse} /> : <Skeleton className="h-28 rounded-2xl" />}
            </div>
            <div className="clay-card p-6" data-testid="recent-activity">
              <h2 className="text-[13px] font-bold tracking-[0.15em] uppercase mb-3" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-heading)' }}>Recent Activity</h2>
              <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                {recentContacts.slice(0, 4).map((c, i) => (
                  <ActivityItem key={c.id} contact={c} type={c.warmthTier === 'hot' || c.warmthTier === 'warm' ? 'reply' : c.warmthTier === 'cold' ? 'ghost' : 'moved'} />
                ))}
              </div>
              <Link href="/contacts" className="flex items-center justify-center gap-1.5 mt-3 text-[12px] font-bold rounded-xl py-2 transition-colors" style={{ color: 'var(--primary)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--hot-bg)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}>
                View all <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>

        {/* ─── Row 3: Pipeline Velocity + Heatmap ─── */}
        <div className="grid grid-cols-12 gap-5 mb-5 animate-fade-in stagger-3">
          <div className="col-span-12 lg:col-span-7">
            <PipelineVelocity velocity={velocity} />
          </div>
          <div className="col-span-12 lg:col-span-5">
            <ActivityHeatmap data={heatmap} />
          </div>
        </div>

        {/* ─── Row 4: Grades ─── */}
        {reportCard && (
          <div className="animate-fade-in stagger-4" data-testid="weekly-grades">
            <div className="flex items-center justify-between mb-4 px-1">
              <div className="flex items-center gap-2">
                <Trophy className="h-4 w-4" style={{ color: 'var(--accent)' }} />
                <h2 className="text-[13px] font-bold tracking-[0.15em] uppercase" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-heading)' }}>Weekly Grades</h2>
              </div>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {reportCard.metrics.map(m => <GradeBadge key={m.name} metric={m} />)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
