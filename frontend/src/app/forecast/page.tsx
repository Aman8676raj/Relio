'use client';

import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle2, RefreshCw, Target } from 'lucide-react';
import { forecastApi } from '@/lib/api';
import type { ForecastSnapshot } from '@/lib/api';

interface ForecastData {
  id: string;
  closeProbability: number;
  projectedCloseDate: string | null;
  meetingsNeededPerWeek: number;
  currentVelocity: number;
  onTrack: boolean;
  targetRaiseUsd: number | null;
  committedUsd: number;
  pipelineValueUsd: number;
  stageConversionRates: Record<string, number>;
  velocityTrend?: string;
  snapshotDate: string;
}

const STAGE_LABELS: Record<string, string> = {
  intro: 'Intro',
  meeting: 'First Meeting',
  dd: 'Due Diligence',
  term_sheet: 'Term Sheet',
};

function ProbabilityRing({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const r = 54;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  const color = pct >= 70 ? '#2D8C5A' : pct >= 40 ? '#E09A36' : '#D35C3E';

  return (
    <div className="relative flex items-center justify-center" style={{ width: 160, height: 160 }}>
      <svg width={160} height={160} className="rotate-[-90deg]">
        <circle cx={80} cy={80} r={r} stroke="rgba(42,35,31,0.08)" strokeWidth={14} fill="none" />
        <circle
          cx={80} cy={80} r={r}
          stroke={color}
          strokeWidth={14}
          fill="none"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 1s ease' }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-4xl font-extrabold tabular-nums" style={{ color, fontFamily: 'var(--font-heading)' }}>{pct}%</span>
        <span className="text-xs font-medium mt-0.5" style={{ color: 'var(--text-muted)' }}>Close probability</span>
      </div>
    </div>
  );
}

function VelocityBar({ current, needed }: { current: number; needed: number }) {
  const max = Math.max(current, needed, 1) * 1.3;
  const currentPct = (current / max) * 100;
  const neededPct = (needed / max) * 100;
  const ok = current >= needed * 0.8;

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
        <span>Current pace</span>
        <span className="tabular-nums" style={{ color: 'var(--text)' }}>{current.toFixed(1)}/wk</span>
      </div>
      <div className="h-2 rounded-full" style={{ background: 'rgba(42,35,31,0.08)' }}>
        <div
          className="h-2 rounded-full transition-all duration-700"
          style={{ width: `${currentPct}%`, background: ok ? '#2D8C5A' : '#D35C3E' }}
        />
      </div>
      <div className="flex justify-between text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
        <span>Target pace</span>
        <span className="tabular-nums" style={{ color: 'var(--text)' }}>{needed.toFixed(1)}/wk</span>
      </div>
      <div className="h-2 rounded-full" style={{ background: 'rgba(42,35,31,0.08)' }}>
        <div
          className="h-2 rounded-full transition-all duration-700"
          style={{ width: `${neededPct}%`, background: 'rgba(42,35,31,0.20)' }}
        />
      </div>
    </div>
  );
}

export default function ForecastPage() {
  const [forecast, setForecast] = useState<ForecastSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = async (forceRefresh = false) => {
    try {
      if (forceRefresh) setRefreshing(true);
      else setLoading(true);

      const data = forceRefresh
        ? await forecastApi.recalculate()
        : await forecastApi.current();
      setForecast(data);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading) return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="max-w-5xl mx-auto space-y-6 animate-pulse">
        <div className="skeleton h-9 w-48 rounded-xl" />
        <div className="grid grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => <div key={i} className="clay-card h-64" />)}
        </div>
      </div>
    </div>
  );

  if (error) return (
    <div className="flex-1 flex items-center justify-center">
      <div className="clay-card p-8 text-center max-w-sm">
        <AlertTriangle className="h-10 w-10 mx-auto mb-3" style={{ color: 'var(--danger)' }} />
        <p className="font-semibold mb-2" style={{ color: 'var(--text)' }}>Couldn't load forecast</p>
        <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>{error}</p>
        <button className="clay-btn clay-btn-sm" onClick={() => load()}>Try again</button>
      </div>
    </div>
  );

  if (!forecast) return null;

  const projectedDate = forecast.projectedCloseDate
    ? new Date(forecast.projectedCloseDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : 'Calculating...';

  const totalPipelineValue = forecast.committedUsd + forecast.pipelineValueUsd;
  const target = forecast.targetRaiseUsd ?? 1_000_000;
  const committedPct = Math.min((forecast.committedUsd / target) * 100, 100);
  const pipelinePct = Math.min((forecast.pipelineValueUsd / target) * 100, 100 - committedPct);

  return (
    <div className="flex-1 overflow-y-auto" style={{ background: 'var(--bg)' }}>
      <div className="max-w-5xl mx-auto p-8 space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between animate-fade-in">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight" style={{ fontFamily: 'var(--font-heading)', color: 'var(--text)' }}>
              Round Forecast
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
              Probability-weighted close prediction based on your live pipeline
            </p>
          </div>
          <button
            className="clay-btn clay-btn-ghost clay-btn-sm flex items-center gap-2"
            onClick={() => load(true)}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Recalculating...' : 'Recalculate'}
          </button>
        </div>

        {/* Status banner */}
        <div
          className="rounded-2xl p-4 flex items-center gap-3 animate-fade-in stagger-1"
          style={{
            background: forecast.onTrack
              ? 'linear-gradient(135deg, rgba(45,140,90,0.08), rgba(45,140,90,0.04))'
              : 'linear-gradient(135deg, rgba(196,61,46,0.08), rgba(196,61,46,0.04))',
            border: `1px solid ${forecast.onTrack ? 'rgba(45,140,90,0.2)' : 'rgba(196,61,46,0.2)'}`,
          }}
        >
          {forecast.onTrack
            ? <CheckCircle2 className="h-5 w-5 shrink-0" style={{ color: '#2D8C5A' }} />
            : <AlertTriangle className="h-5 w-5 shrink-0" style={{ color: 'var(--danger)' }} />
          }
          <p className="text-sm font-medium" style={{ color: forecast.onTrack ? '#2D8C5A' : 'var(--danger)' }}>
            {forecast.onTrack
              ? `You're on track — current pace of ${forecast.currentVelocity.toFixed(1)} meetings/week meets your target.`
              : `You need ${forecast.meetingsNeededPerWeek.toFixed(1)} first meetings/week — current pace is ${forecast.currentVelocity.toFixed(1)}. You're behind.`}
          </p>
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-3 gap-5 animate-fade-in stagger-2">

          {/* Close probability ring */}
          <div className="clay-card p-6 flex flex-col items-center gap-4 col-span-1">
            <ProbabilityRing value={forecast.closeProbability} />
            <div className="w-full text-center space-y-1">
              <p className="text-xs uppercase tracking-wider font-semibold" style={{ color: 'var(--text-muted)' }}>Projected close</p>
              <p className="text-lg font-bold" style={{ fontFamily: 'var(--font-heading)', color: 'var(--text)' }}>{projectedDate}</p>
            </div>
          </div>

          {/* Raise progress */}
          <div className="clay-card p-6 col-span-2 space-y-5">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4" style={{ color: 'var(--primary)' }} />
              <p className="text-sm font-bold" style={{ fontFamily: 'var(--font-heading)', color: 'var(--text)' }}>Raise Progress</p>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span style={{ color: 'var(--text-muted)' }}>Target</span>
                <span className="font-bold tabular-nums" style={{ color: 'var(--text)' }}>
                  ${(target / 1_000_000).toFixed(1)}M
                </span>
              </div>

              {/* Stacked progress bar */}
              <div className="h-4 rounded-full flex overflow-hidden" style={{ background: 'rgba(42,35,31,0.08)' }}>
                <div
                  className="h-full transition-all duration-700 rounded-l-full"
                  style={{ width: `${committedPct}%`, background: '#2D8C5A' }}
                  title={`Committed: $${(forecast.committedUsd / 1000).toFixed(0)}k`}
                />
                <div
                  className="h-full transition-all duration-700"
                  style={{ width: `${pipelinePct}%`, background: 'rgba(224,154,54,0.6)' }}
                  title={`Pipeline: $${(forecast.pipelineValueUsd / 1000).toFixed(0)}k`}
                />
              </div>

              <div className="flex gap-4 text-xs" style={{ color: 'var(--text-muted)' }}>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: '#2D8C5A' }} />
                  Committed ${(forecast.committedUsd / 1000).toFixed(0)}k
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: 'rgba(224,154,54,0.6)' }} />
                  Weighted pipeline ${(forecast.pipelineValueUsd / 1000).toFixed(0)}k
                </span>
              </div>
            </div>

            <div className="border-t pt-4" style={{ borderColor: 'var(--border)' }}>
              <p className="text-sm font-bold mb-3" style={{ fontFamily: 'var(--font-heading)', color: 'var(--text)' }}>Meeting Velocity</p>
              <VelocityBar current={forecast.currentVelocity} needed={forecast.meetingsNeededPerWeek} />
            </div>
          </div>
        </div>

        {/* Stage conversion rates */}
        <div className="clay-card p-6 animate-fade-in stagger-3">
          <p className="text-sm font-bold mb-5" style={{ fontFamily: 'var(--font-heading)', color: 'var(--text)' }}>
            Stage Conversion Rates
            <span className="ml-2 text-xs font-normal" style={{ color: 'var(--text-muted)' }}>
              (from your actual pipeline history)
            </span>
          </p>
          <div className="grid grid-cols-4 gap-4">
            {Object.entries(forecast.stageConversionRates).map(([stage, rate]) => {
              const pct = Math.round(rate * 100);
              const color = pct >= 60 ? '#2D8C5A' : pct >= 35 ? '#E09A36' : '#D35C3E';
              return (
                <div key={stage} className="clay-card-sm p-4 text-center">
                  <p className="text-2xl font-extrabold tabular-nums" style={{ color, fontFamily: 'var(--font-heading)' }}>{pct}%</p>
                  <p className="text-xs mt-1 font-medium" style={{ color: 'var(--text-muted)' }}>{STAGE_LABELS[stage] ?? stage}</p>
                  <div className="mt-2 h-1.5 rounded-full" style={{ background: 'rgba(42,35,31,0.08)' }}>
                    <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, background: color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Snapshot note */}
        <p className="text-xs text-center pb-4" style={{ color: 'var(--text-muted)' }}>
          Last calculated: {new Date(forecast.createdAt ?? new Date()).toLocaleDateString()}
        </p>
      </div>
    </div>
  );
}
