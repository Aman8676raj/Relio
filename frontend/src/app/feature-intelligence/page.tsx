'use client';

import { useState, useEffect, useRef } from 'react';
import {
  featureIntelligenceApi,
  type FounderProfile,
  type FeatureAnalysisResult,
  type FounderProfileInput,
  type PipelineEvent,
} from '@/lib/api';
import {
  Brain, Sparkles, CheckCircle2, Clock, XCircle, TrendingUp,
  Users, ChevronRight, ChevronDown, Settings2, Send,
  AlertTriangle, RefreshCw, Building2, Lightbulb, BarChart3,
  ArrowRight, History, Plus, X,
} from 'lucide-react';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timeAgo(d: string): string {
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function VerdictBadge({ verdict }: { verdict: string | null }) {
  const config = {
    build: { label: 'Build It', icon: CheckCircle2, color: 'var(--success)', bg: 'var(--success-bg)' },
    defer: { label: 'Defer', icon: Clock, color: 'var(--accent)', bg: 'var(--warm-bg)' },
    kill: { label: 'Kill', icon: XCircle, color: 'var(--danger)', bg: 'var(--danger-bg)' },
    'needs-validation': { label: 'Validate', icon: AlertTriangle, color: 'var(--accent)', bg: 'var(--warm-bg)' },
  }[verdict ?? 'defer'] ?? { label: verdict ?? 'Unknown', icon: Clock, color: 'var(--text-muted)', bg: 'var(--bg)' };

  return (
    <span
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[13px] font-bold"
      style={{ backgroundColor: config.bg, color: config.color }}
    >
      <config.icon className="h-3.5 w-3.5" />
      {config.label}
    </span>
  );
}

function ScoreRing({ score, color, label }: { score: number; color: string; label: string }) {
  const r = 28;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: 72, height: 72 }}>
        <svg width="72" height="72" viewBox="0 0 72 72" className="-rotate-90">
          <circle cx="36" cy="36" r={r} fill="none" stroke="var(--border)" strokeWidth="6" />
          <circle cx="36" cy="36" r={r} fill="none" stroke={color} strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circ - dash}`}
            style={{ transition: 'stroke-dasharray 1s cubic-bezier(0.22,1,0.36,1)' }} />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[17px] font-extrabold tabular-nums" style={{ color, fontFamily: 'var(--font-heading)' }}>
            {score}
          </span>
        </div>
      </div>
      <span className="text-[11px] font-semibold uppercase tracking-wider text-center" style={{ color: 'var(--text-muted)' }}>
        {label}
      </span>
    </div>
  );
}

// ─── Profile Setup Modal ──────────────────────────────────────────────────────

const STAGES = ['pre-seed', 'seed', 'series-a', 'series-b', 'series-c', 'growth'];

function ProfileModal({
  existing,
  onSave,
  onClose,
}: {
  existing: FounderProfile | null;
  onSave: (p: FounderProfile) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<FounderProfileInput>({
    appName: existing?.appName ?? '',
    appDescription: existing?.appDescription ?? '',
    targetMarket: existing?.targetMarket ?? '',
    currentMRR: existing?.currentMRR ?? 0,
    stage: existing?.stage ?? 'seed',
    fundingGoal: existing?.fundingGoal ?? 1000000,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const result = await featureIntelligenceApi.upsertProfile(form);
      onSave(result);
    } catch (err: any) {
      setError(err.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  }

  const field = (label: string, key: keyof FounderProfileInput, type = 'text', placeholder = '') => (
    <div>
      <label className="block text-[12px] font-semibold mb-1.5 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
        {label}
      </label>
      <input
        type={type}
        value={form[key] as string | number}
        onChange={e => setForm(f => ({ ...f, [key]: type === 'number' ? Number(e.target.value) : e.target.value }))}
        placeholder={placeholder}
        className="w-full rounded-xl px-3 py-2.5 text-[14px] transition-all duration-200"
        style={{ backgroundColor: 'var(--bg)', border: '1.5px solid var(--border)', color: 'var(--text)' }}
        onFocus={e => { e.currentTarget.style.borderColor = 'var(--primary)'; }}
        onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
      />
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-lg rounded-3xl p-6 shadow-2xl" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl" style={{ background: 'linear-gradient(135deg, var(--primary), #E8734F)' }}>
              <Settings2 className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-[17px] font-bold" style={{ color: 'var(--text)', fontFamily: 'var(--font-heading)' }}>
                {existing ? 'Update' : 'Setup'} Founder Profile
              </h2>
              <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
                Context used to personalise every analysis
              </p>
            </div>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-xl transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {field('App / Product Name', 'appName', 'text', 'e.g. Relio CRM')}
          <div>
            <label className="block text-[12px] font-semibold mb-1.5 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              App Description
            </label>
            <textarea
              value={form.appDescription}
              onChange={e => setForm(f => ({ ...f, appDescription: e.target.value }))}
              placeholder="Briefly describe what your app does and who it's for"
              rows={3}
              className="w-full rounded-xl px-3 py-2.5 text-[14px] resize-none transition-all duration-200"
              style={{ backgroundColor: 'var(--bg)', border: '1.5px solid var(--border)', color: 'var(--text)' }}
              onFocus={e => { e.currentTarget.style.borderColor = 'var(--primary)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            {field('Target Market', 'targetMarket', 'text', 'e.g. B2B SaaS founders')}
            <div>
              <label className="block text-[12px] font-semibold mb-1.5 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                Stage
              </label>
              <select
                value={form.stage}
                onChange={e => setForm(f => ({ ...f, stage: e.target.value }))}
                className="w-full rounded-xl px-3 py-2.5 text-[14px]"
                style={{ backgroundColor: 'var(--bg)', border: '1.5px solid var(--border)', color: 'var(--text)' }}>
                {STAGES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {field('Current MRR ($)', 'currentMRR', 'number')}
            {field('Funding Goal ($)', 'fundingGoal', 'number')}
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-[13px]" style={{ backgroundColor: 'var(--danger-bg)', color: 'var(--danger)' }}>
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 rounded-xl py-2.5 text-[14px] font-semibold transition-colors"
              style={{ backgroundColor: 'var(--bg)', color: 'var(--text-muted)' }}>
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-[14px] font-bold text-white transition-all duration-200 disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, var(--primary), #E8734F)' }}>
              {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {saving ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Analysis Result Card ─────────────────────────────────────────────────────

function AnalysisCard({
  result,
  expanded,
  onToggle,
}: {
  result: FeatureAnalysisResult;
  expanded: boolean;
  onToggle: () => void;
}) {
  const verdictColor = {
    build: 'var(--success)',
    defer: 'var(--accent)',
    kill: 'var(--danger)',
    'needs-validation': 'var(--accent)',
  }[result.verdict ?? 'defer'] ?? 'var(--text-muted)';

  return (
    <div
      className="rounded-2xl overflow-hidden transition-all duration-300 cursor-pointer"
      style={{
        backgroundColor: 'var(--surface)',
        boxShadow: 'var(--shadow-clay-sm)',
        border: `1px solid ${expanded ? verdictColor + '40' : 'rgba(255,255,255,0.4)'}`,
      }}
      onClick={onToggle}
    >
      {/* Header */}
      <div className="flex items-start gap-4 p-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{ background: `linear-gradient(135deg, ${verdictColor}22, ${verdictColor}08)`, border: `1px solid ${verdictColor}30` }}>
          <Brain className="h-5 w-5" style={{ color: verdictColor }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <p className="text-[15px] font-bold leading-snug" style={{ color: 'var(--text)', fontFamily: 'var(--font-heading)' }}>
              {result.featureName}
            </p>
            <div className="flex items-center gap-2 shrink-0">
              <VerdictBadge verdict={result.verdict} />
              {expanded ? <ChevronDown className="h-4 w-4" style={{ color: 'var(--text-muted)' }} /> : <ChevronRight className="h-4 w-4" style={{ color: 'var(--text-muted)' }} />}
            </div>
          </div>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{timeAgo(result.createdAt)}</span>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
              style={{ backgroundColor: 'var(--bg)', color: 'var(--text-muted)' }}>
              {result.investorAlignmentScore}% investor fit
            </span>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
              style={{ backgroundColor: 'var(--bg)', color: 'var(--text-muted)' }}>
              ${result.revenueImpactLow.toLocaleString()}–${result.revenueImpactHigh.toLocaleString()} MRR
            </span>
          </div>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t px-5 pb-5 pt-4 space-y-5" style={{ borderColor: 'var(--border)' }}
          onClick={e => e.stopPropagation()}>

          {/* Score rings */}
          <div className="flex items-center justify-around py-2">
            <ScoreRing score={result.investorAlignmentScore} color="var(--primary)" label="Investor Fit" />
            <div className="text-center">
              <p className="text-[22px] font-extrabold" style={{ color: 'var(--success)', fontFamily: 'var(--font-heading)' }}>
                ${result.revenueImpactLow.toLocaleString()}–${result.revenueImpactHigh.toLocaleString()}
              </p>
              <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                Est. MRR Impact
              </p>
            </div>
          </div>

          {/* Verdict reasoning */}
          {result.verdictReasoning && (
            <div className="rounded-2xl p-4" style={{ backgroundColor: 'var(--bg)', border: '1px dashed var(--border)' }}>
              <div className="flex items-center gap-2 mb-2">
                <Lightbulb className="h-4 w-4" style={{ color: 'var(--primary)' }} />
                <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--primary)' }}>
                  Verdict Reasoning
                </span>
              </div>
              <p className="text-[13px] leading-relaxed" style={{ color: 'var(--text)' }}>
                {result.verdictReasoning}
              </p>
            </div>
          )}

          {/* Recommendations */}
          {result.recommendations?.length > 0 && (
            <div className="rounded-2xl p-4" style={{ backgroundColor: 'var(--success-bg)' }}>
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="h-4 w-4" style={{ color: 'var(--success)' }} />
                <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--success)' }}>Recommendations</span>
              </div>
              <ul className="space-y-2">
                {result.recommendations.map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-[12px]" style={{ color: 'var(--text)' }}>
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold mt-0.5"
                      style={{ backgroundColor: 'var(--surface)', color: 'var(--success)', border: '1px solid var(--border)' }}>
                      {r.priority}
                    </span>
                    <div>
                      <span className="font-bold">{r.action}</span>
                      <br />
                      <span style={{ color: 'var(--text-muted)' }}>{r.rationale}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {/* Aligned Investors */}
            {result.alignedInvestors?.length > 0 && (
              <div className="rounded-2xl p-4" style={{ backgroundColor: 'var(--warm-bg)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <Users className="h-4 w-4" style={{ color: 'var(--accent)' }} />
                  <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--accent)' }}>Aligned Investors</span>
                </div>
                {result.alignedInvestors.map((inv, i) => (
                  <div key={i} className="mb-2 last:mb-0">
                    <p className="text-[12px] font-bold" style={{ color: 'var(--text)' }}>{inv.name} @ {inv.firm}</p>
                    <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{inv.reason}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Market Precedents */}
            {result.marketPrecedents?.length > 0 && (
              <div className="rounded-2xl p-4" style={{ backgroundColor: 'var(--bg)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <Building2 className="h-4 w-4" style={{ color: 'var(--text-muted)' }} />
                  <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Market Precedents</span>
                </div>
                {result.marketPrecedents.map((p, i) => (
                  <div key={i} className="mb-2 last:mb-0">
                    <p className="text-[12px] font-bold" style={{ color: 'var(--text)' }}>{p.product}</p>
                    <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{p.outcome}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Pipeline Progress (SSE-driven) ──────────────────────────────────────────

interface StageState {
  status: 'pending' | 'running' | 'done' | 'timeout' | 'error';
  elapsed?: number;
  detail?: string;
}

function PipelineProgress({
  stages,
  elapsed,
}: {
  stages: StageState[];
  elapsed: number;
}) {
  const stageConfig = [
    { icon: Settings2, label: 'Context Assembly', desc: 'Pulling your MRR, stage, and investor pipeline from the CRM' },
    { icon: Brain, label: 'Market Intelligence', desc: 'Claude is searching the web for market signals, competitor data, and trends' },
    { icon: Sparkles, label: 'Synthesis', desc: 'Generating your personalised verdict, revenue impact, and investor alignment' },
  ];

  return (
    <div className="clay-card p-6 mb-5 animate-fade-in">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{ background: 'var(--hot-bg)', border: '1px solid rgba(255,107,53,0.2)' }}>
            <Brain className="h-5 w-5 animate-pulse" style={{ color: 'var(--primary)' }} />
          </div>
          <div>
            <p className="text-[14px] font-bold" style={{ color: 'var(--text)' }}>Analysing your feature idea…</p>
            <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>Real-time updates from the pipeline</p>
          </div>
        </div>
        <span className="text-[20px] font-extrabold tabular-nums px-3 py-1 rounded-xl"
          style={{ backgroundColor: 'var(--bg)', color: 'var(--primary)', fontFamily: 'var(--font-heading)' }}>
          {elapsed}s
        </span>
      </div>

      <div className="space-y-0">
        {stageConfig.map(({ icon: Icon, label, desc }, i) => {
          const state = stages[i];
          const isActive = state.status === 'running';
          const isDone = state.status === 'done' || state.status === 'timeout';
          const isTimeout = state.status === 'timeout';
          const isPending = state.status === 'pending';
          const isError = state.status === 'error';

          return (
            <div key={i}>
              <div className="flex items-start gap-4 py-3">
                <div className="flex flex-col items-center">
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-500 ${isActive ? 'animate-pulse' : ''}`}
                    style={{
                      background: isDone && !isTimeout ? 'var(--success-bg)' : isTimeout ? 'var(--warm-bg)' : isActive ? 'var(--hot-bg)' : isError ? 'var(--danger-bg)' : 'var(--bg)',
                      border: `1.5px solid ${isDone && !isTimeout ? 'rgba(34,197,94,0.3)' : isTimeout ? 'rgba(224,154,54,0.3)' : isActive ? 'rgba(255,107,53,0.3)' : isError ? 'rgba(220,53,69,0.3)' : 'var(--border)'}`,
                    }}
                  >
                    {isDone && !isTimeout ? (
                      <CheckCircle2 className="h-4 w-4" style={{ color: 'var(--success)' }} />
                    ) : isTimeout ? (
                      <Clock className="h-4 w-4" style={{ color: 'var(--accent)' }} />
                    ) : isError ? (
                      <XCircle className="h-4 w-4" style={{ color: 'var(--danger)' }} />
                    ) : (
                      <Icon className="h-4 w-4" style={{ color: isActive ? 'var(--primary)' : 'var(--text-muted)', opacity: isPending ? 0.4 : 1 }} />
                    )}
                  </div>
                  {i < 2 && (
                    <div className="w-[2px] h-4 rounded-full mt-1" style={{
                      backgroundColor: isDone ? (isTimeout ? 'var(--accent)' : 'var(--success)') : 'var(--border)',
                      opacity: isDone ? 0.4 : 0.2,
                    }} />
                  )}
                </div>
                <div className="flex-1 min-w-0 pt-0.5">
                  <div className="flex items-center gap-2">
                    <p className="text-[14px] font-bold transition-colors duration-300"
                      style={{ color: isPending ? 'var(--text-muted)' : 'var(--text)', opacity: isPending ? 0.5 : 1 }}>
                      {label}
                    </p>
                    {isActive && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse"
                        style={{ backgroundColor: 'var(--hot-bg)', color: 'var(--primary)' }}>
                        IN PROGRESS
                      </span>
                    )}
                    {isDone && !isTimeout && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: 'var(--success-bg)', color: 'var(--success)' }}>
                        DONE {state.elapsed != null ? `(${(state.elapsed / 1000).toFixed(1)}s)` : ''}
                      </span>
                    )}
                    {isTimeout && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: 'var(--warm-bg)', color: 'var(--accent)' }}>
                        TIMED OUT — continuing
                      </span>
                    )}
                    {isError && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: 'var(--danger-bg)', color: 'var(--danger)' }}>
                        ERROR
                      </span>
                    )}
                  </div>
                  <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-muted)', opacity: isPending ? 0.4 : 0.8 }}>
                    {state.detail || (isActive ? desc : isPending ? 'Waiting…' : 'Completed')}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function FeatureIntelligencePage() {
  const [profile, setProfile] = useState<FounderProfile | null>(null);
  const [history, setHistory] = useState<FeatureAnalysisResult[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [form, setForm] = useState({
    featureName: '',
    featureDescription: '',
    featureCategory: 'revenue',
  });
  const [analyzing, setAnalyzing] = useState(false);
  const [pipelineStages, setPipelineStages] = useState<StageState[]>([
    { status: 'pending' },
    { status: 'pending' },
    { status: 'pending' },
  ]);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    featureIntelligenceApi.getProfile()
      .then(p => setProfile(p))
      .catch(() => setProfile(null))
      .finally(() => setProfileLoading(false));

    featureIntelligenceApi.list()
      .then(items => setHistory(Array.isArray(items) ? items : []))
      .catch(() => setHistory([]))
      .finally(() => setHistoryLoading(false));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      esRef.current?.close();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  function handlePipelineEvent(event: PipelineEvent) {
    if (event.type === 'stage_start' && event.stage) {
      setPipelineStages(prev => prev.map((s, i) =>
        i === event.stage! - 1 ? { status: 'running' } : s
      ));
    }

    if (event.type === 'stage_done' && event.stage) {
      setPipelineStages(prev => prev.map((s, i) =>
        i === event.stage! - 1
          ? { status: 'done', elapsed: event.elapsed, detail: event.detail }
          : s
      ));
    }

    if (event.type === 'stage_timeout' && event.stage) {
      setPipelineStages(prev => prev.map((s, i) =>
        i === event.stage! - 1
          ? { status: 'timeout', elapsed: event.elapsed, detail: event.detail }
          : s
      ));
    }

    if (event.type === 'stage_error' && event.stage) {
      setPipelineStages(prev => prev.map((s, i) =>
        i === event.stage! - 1
          ? { status: 'error', detail: event.detail }
          : s
      ));
    }

    if (event.type === 'complete') {
      if (timerRef.current) clearInterval(timerRef.current);
      setAnalyzing(false);

      // The result is the full DB record
      if (event.result) {
        const result = event.result as unknown as FeatureAnalysisResult;
        setExpandedId(result.id);
        setHistory(prev => [result, ...prev]);
      }
      setForm({ featureName: '', featureDescription: '', featureCategory: 'revenue' });
    }

    if (event.type === 'failed') {
      if (timerRef.current) clearInterval(timerRef.current);
      setAnalyzing(false);
      setError(event.detail || 'Pipeline failed. Please try again.');
    }
  }

  async function runAnalysis(e?: React.FormEvent) {
    e?.preventDefault();
    if (!form.featureName.trim() || form.featureDescription.length < 50 || analyzing) return;
    if (!profile) { setShowProfileModal(true); return; }

    setAnalyzing(true);
    setElapsed(0);
    setError('');
    setPipelineStages([
      { status: 'pending' },
      { status: 'pending' },
      { status: 'pending' },
    ]);

    // Start elapsed timer
    const startTime = Date.now();
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    try {
      // 1. Fire-and-forget POST — get analysisId
      const { analysisId } = await featureIntelligenceApi.analyze(form);

      // 2. Open SSE stream for real-time progress
      esRef.current = featureIntelligenceApi.streamAnalysis(
        analysisId,
        handlePipelineEvent,
        () => {
          // SSE error — fallback: poll for result
          if (timerRef.current) clearInterval(timerRef.current);
          setAnalyzing(false);
          setError('Lost connection to pipeline. Refresh to check if the analysis completed.');
        },
      );
    } catch (err: any) {
      if (timerRef.current) clearInterval(timerRef.current);
      setAnalyzing(false);
      setError(err.message || 'Failed to start analysis.');
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      runAnalysis();
    }
  }

  const profileComplete = !!profile;

  return (
    <div className="flex-1 overflow-y-auto px-6 py-6">
      <div className="max-w-[860px] mx-auto">

        {/* ─── Header ─── */}
        <div className="flex items-start justify-between mb-6 animate-fade-in">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl shrink-0"
              style={{ background: 'linear-gradient(135deg, var(--primary), #E8734F)', boxShadow: '0 8px 24px rgba(255,107,53,0.25)' }}>
              <Brain className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-[22px] font-extrabold tracking-tight" style={{ color: 'var(--text)', fontFamily: 'var(--font-heading)' }}>
                Feature Intelligence
              </h1>
              <p className="text-[13px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                AI-powered feature analysis grounded in your live fundraising context
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowProfileModal(true)}
            className="flex items-center gap-2 rounded-2xl px-4 py-2.5 text-[13px] font-semibold transition-all duration-200"
            style={{
              backgroundColor: profileComplete ? 'var(--success-bg)' : 'var(--hot-bg)',
              color: profileComplete ? 'var(--success)' : 'var(--primary)',
              border: `1px solid ${profileComplete ? 'rgba(53,188,97,0.2)' : 'rgba(255,107,53,0.2)'}`,
            }}
          >
            {profileComplete ? <CheckCircle2 className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {profileComplete ? profile.appName : 'Setup Profile'}
          </button>
        </div>

        {/* ─── Profile missing banner ─── */}
        {!profileLoading && !profileComplete && (
          <div className="rounded-2xl p-4 mb-5 flex items-center justify-between animate-fade-in"
            style={{ backgroundColor: 'var(--warm-bg)', border: '1px solid rgba(224,154,54,0.25)' }}>
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 shrink-0" style={{ color: 'var(--accent)' }} />
              <div>
                <p className="text-[14px] font-bold" style={{ color: 'var(--text)' }}>Profile required</p>
                <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
                  Set up your founder profile so the AI can personalise analysis with your MRR, stage, and investor pipeline.
                </p>
              </div>
            </div>
            <button onClick={() => setShowProfileModal(true)}
              className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-[13px] font-bold text-white shrink-0 ml-4"
              style={{ background: 'linear-gradient(135deg, var(--accent), #C47A20)' }}>
              Set Up <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* ─── Analyse Bar ─── */}
        <div className="clay-card p-6 mb-6 animate-fade-in stagger-2">
          <div className="flex items-start gap-2 mb-4">
            <Sparkles className="h-4 w-4 mt-0.5 shrink-0" style={{ color: 'var(--primary)' }} />
            <span className="text-[12px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-heading)' }}>
              Analyse a Feature Idea
            </span>
          </div>

          <form onSubmit={runAnalysis} className="space-y-4">
            <div className="grid grid-cols-[2fr_1fr] gap-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-muted)' }}>Feature Name</label>
                <input
                  value={form.featureName}
                  onChange={e => setForm(f => ({ ...f, featureName: e.target.value }))}
                  placeholder="e.g. AI-driven Attrition Predictor"
                  disabled={analyzing}
                  className="w-full rounded-xl px-4 py-2.5 text-[14px] transition-all duration-200 disabled:opacity-50"
                  style={{ backgroundColor: 'var(--bg)', border: '1.5px solid var(--border)', color: 'var(--text)' }}
                  onFocus={e => { e.currentTarget.style.borderColor = 'var(--primary)'; }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-muted)' }}>Category</label>
                <select
                  value={form.featureCategory}
                  onChange={e => setForm(f => ({ ...f, featureCategory: e.target.value }))}
                  disabled={analyzing}
                  className="w-full rounded-xl px-4 py-2.5 text-[14px] transition-all duration-200 disabled:opacity-50"
                  style={{ backgroundColor: 'var(--bg)', border: '1.5px solid var(--border)', color: 'var(--text)' }}
                  onFocus={e => { e.currentTarget.style.borderColor = 'var(--primary)'; }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
                >
                  <option value="revenue">Revenue</option>
                  <option value="retention">Retention</option>
                  <option value="acquisition">Acquisition</option>
                  <option value="moat">Moat (Defensibility)</option>
                  <option value="dx">Developer/User Experience</option>
                </select>
              </div>
            </div>

            <div className="relative">
              <label className="block text-[11px] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-muted)' }}>Detailed Description & Mechanics</label>
              <textarea
                ref={textareaRef}
                value={form.featureDescription}
                onChange={e => setForm(f => ({ ...f, featureDescription: e.target.value }))}
                onKeyDown={handleKeyDown}
                placeholder="Describe how the feature works, what data it uses, and the specific user pain point it solves..."
                rows={3}
                disabled={analyzing}
                className="w-full rounded-xl px-4 py-3.5 text-[14px] resize-none transition-all duration-200 disabled:opacity-50"
                style={{ backgroundColor: 'var(--bg)', border: '1.5px solid var(--border)', color: 'var(--text)', lineHeight: '1.6' }}
                onFocus={e => { e.currentTarget.style.borderColor = 'var(--primary)'; }}
                onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
              />
              <div className="absolute right-3 bottom-3 flex items-center gap-3">
                <span className="text-[11px] font-medium" style={{ color: form.featureDescription.length >= 50 ? 'var(--success)' : 'var(--text-muted)' }}>
                  {form.featureDescription.length}/50
                </span>
                <button
                  type="submit"
                  disabled={!form.featureName.trim() || form.featureDescription.length < 50 || analyzing}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-white transition-all duration-200 disabled:opacity-40"
                  style={{ background: 'linear-gradient(135deg, var(--primary), #E8734F)', boxShadow: '0 4px 12px rgba(255,107,53,0.3)' }}
                  title="Analyse (⌘ + Enter)"
                >
                  {analyzing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between mt-2">
              <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                ⌘ + Enter to analyse · Powered by Claude + live web search
              </span>
              {analyzing && (
                <span className="text-[11px] font-semibold flex items-center gap-1.5 animate-pulse" style={{ color: 'var(--primary)' }}>
                  <Brain className="h-3.5 w-3.5" /> Pipeline running…
                </span>
              )}
            </div>
          </form>
        </div>

        {/* ─── Error ─── */}
        {error && (
          <div className="flex items-center gap-2 rounded-2xl px-4 py-3 mb-5 text-[13px]"
            style={{ backgroundColor: 'var(--danger-bg)', color: 'var(--danger)', border: '1px solid rgba(220,53,69,0.2)' }}>
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {error}
            <button onClick={() => setError('')} className="ml-auto"><X className="h-4 w-4" /></button>
          </div>
        )}

        {/* ─── How it works (empty state) ─── */}
        {!historyLoading && history.length === 0 && !analyzing && (
          <div className="clay-card p-6 mb-6 animate-fade-in stagger-3">
            <div className="flex items-center gap-2 mb-5">
              <BarChart3 className="h-4 w-4" style={{ color: 'var(--text-muted)' }} />
              <span className="text-[12px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-heading)' }}>
                How It Works
              </span>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {[
                { step: '1', icon: Settings2, color: 'var(--primary)', title: 'Context Assembly', desc: 'Pulls your MRR, stage, and live investor pipeline from the CRM' },
                { step: '2', icon: Brain, color: 'var(--accent)', title: 'Market Intelligence', desc: 'Claude searches the web for real market signals, competitor precedents, and trends' },
                { step: '3', icon: Sparkles, color: 'var(--success)', title: 'Synthesis', desc: 'Generates a personalised verdict, revenue impact estimate, and investor alignment score' },
              ].map(({ step, icon: Icon, color, title, desc }) => (
                <div key={step} className="flex flex-col items-center text-center p-4 rounded-2xl" style={{ backgroundColor: 'var(--bg)' }}>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl mb-3"
                    style={{ background: `color-mix(in srgb, ${color} 12%, transparent)`, border: `1px solid color-mix(in srgb, ${color} 25%, transparent)` }}>
                    <Icon className="h-5 w-5" style={{ color }} />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--text-muted)' }}>Stage {step}</span>
                  <p className="text-[13px] font-bold mb-1" style={{ color: 'var(--text)', fontFamily: 'var(--font-heading)' }}>{title}</p>
                  <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>{desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─── Pipeline Progress (SSE-driven) ─── */}
        {analyzing && (
          <PipelineProgress stages={pipelineStages} elapsed={elapsed} />
        )}

        {/* ─── Analysis History ─── */}
        {history.length > 0 && (
          <div className="animate-fade-in stagger-3">
            <div className="flex items-center gap-2 mb-4 px-1">
              <History className="h-4 w-4" style={{ color: 'var(--text-muted)' }} />
              <h2 className="text-[12px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-heading)' }}>
                Analysis History
              </h2>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'var(--hot-bg)', color: 'var(--primary)' }}>
                {history.length}
              </span>
            </div>
            <div className="space-y-3">
              {history.map(result => (
                <AnalysisCard
                  key={result.id}
                  result={result}
                  expanded={expandedId === result.id}
                  onToggle={() => setExpandedId(prev => prev === result.id ? null : result.id)}
                />
              ))}
            </div>
          </div>
        )}

      </div>

      {/* ─── Profile Modal ─── */}
      {showProfileModal && (
        <ProfileModal
          existing={profile}
          onSave={p => { setProfile(p); setShowProfileModal(false); }}
          onClose={() => setShowProfileModal(false)}
        />
      )}
    </div>
  );
}
