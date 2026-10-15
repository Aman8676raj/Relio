'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  discoveryApi,
  type StartupProfile,
  type ScoredInvestor,
  type DiscoveryScoreBreakdown,
  type InvestorRecord,
} from '@/lib/api';
import {
  Sparkles, Search, ChevronRight, ChevronLeft, X,
  Target, Brain, Zap, Link2, MapPin, DollarSign,
  TrendingUp, Building2, ExternalLink, Globe, BarChart3,
  SlidersHorizontal, ArrowRight, Loader2, CheckCircle2,
} from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────

const STAGES = ['pre-seed', 'seed', 'series-a', 'series-b', 'growth'];
const SECTORS = [
  'SaaS', 'Fintech', 'Healthcare', 'AI/ML', 'Climate', 'E-commerce',
  'Edtech', 'Biotech', 'Enterprise', 'Consumer', 'Infrastructure',
  'Marketplace', 'Blockchain', 'Security', 'Media', 'Social',
];

const STAGE_COLORS: Record<string, string> = {
  'pre-seed': '#8B5CF6',
  'seed': '#F59E0B',
  'series-a': '#10B981',
  'series-b': '#3B82F6',
  'series-c': '#6366F1',
  'growth': '#EC4899',
};

const SCORE_LABELS: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  portfolioFit: { label: 'Portfolio Fit', icon: <Target size={14} />, color: '#10B981' },
  thesisAlignment: { label: 'Thesis', icon: <Brain size={14} />, color: '#8B5CF6' },
  warmPath: { label: 'Warm Path', icon: <Link2 size={14} />, color: '#F59E0B' },
  fundDeployment: { label: 'Fund Status', icon: <Zap size={14} />, color: '#3B82F6' },
};

function formatCheckSize(min: number | null, max: number | null): string {
  const fmt = (n: number) => {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
    if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
    return `$${n}`;
  };
  if (min && max) return `${fmt(min)} – ${fmt(max)}`;
  if (min) return `${fmt(min)}+`;
  if (max) return `Up to ${fmt(max)}`;
  return '—';
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DiscoverPage() {
  const queryClient = useQueryClient();

  // Fetch profile
  const { data: profileData, isLoading: profileLoading } = useQuery({
    queryKey: ['discovery-profile'],
    queryFn: () => discoveryApi.getProfile(),
  });

  const needsSetup = !profileData || 'needsSetup' in profileData;
  const profile = needsSetup ? null : (profileData as StartupProfile);

  const [showProfileEditor, setShowProfileEditor] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [isScoring, setIsScoring] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { setPage(1); }, [debouncedSearch]);

  // Search
  const { data: searchData, isLoading: searchLoading } = useQuery({
    queryKey: ['discovery-search', page, debouncedSearch],
    queryFn: () =>
      discoveryApi.search({
        page: String(page),
        limit: '20',
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
      }),
    enabled: !needsSetup,
  });

  // Batch scoring mutation
  const batchScoreMut = useMutation({
    mutationFn: () => discoveryApi.batchScore(50),
    onMutate: () => setIsScoring(true),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discovery-search'] });
      setIsScoring(false);
    },
    onError: () => setIsScoring(false),
  });

  const results = searchData?.data || [];
  const meta = searchData?.meta;

  if (profileLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 size={24} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
      </div>
    );
  }

  // Show setup flow if no profile
  if (needsSetup || showProfileEditor) {
    return (
      <div style={{ maxWidth: 680, margin: '0 auto', padding: 'var(--space-8)' }}>
        <StartupProfileForm
          initial={profile}
          onComplete={() => {
            setShowProfileEditor(false);
            queryClient.invalidateQueries({ queryKey: ['discovery-profile'] });
            queryClient.invalidateQueries({ queryKey: ['discovery-search'] });
          }}
        />
      </div>
    );
  }

  return (
    <div className="overflow-y-auto h-full" style={{ padding: 'var(--space-6) var(--space-8)' }}>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1
            style={{
              fontSize: 28, fontWeight: 800,
              fontFamily: "'Manrope', system-ui, sans-serif",
              letterSpacing: '-0.02em', color: 'var(--text)',
            }}
          >
            <Sparkles size={24} style={{ display: 'inline', marginRight: 10, verticalAlign: 'text-bottom', color: 'var(--primary)' }} />
            Investor Discovery
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 4 }}>
            AI-scored matches based on your startup profile
          </p>
        </div>
        <button
          className="clay-btn-ghost"
          onClick={() => setShowProfileEditor(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}
        >
          <SlidersHorizontal size={14} />
          Edit Profile
        </button>
      </div>

      {/* Profile summary bar */}
      {profile && (
        <div className="clay-card-sm flex items-center gap-5 mb-6 animate-fade-in" style={{ padding: '12px 20px' }}>
          <ProfileTag label="Stage" value={profile.stage} color={STAGE_COLORS[profile.stage || ''] || 'var(--text-muted)'} />
          <ProfileTag label="Sector" value={profile.sector} />
          <ProfileTag label="Raising" value={profile.raiseTargetUsd ? `$${(profile.raiseTargetUsd / 1_000_000).toFixed(1)}M` : null} />
          <ProfileTag label="Location" value={profile.geography} />
          <div className="ml-auto">
            <button
              className="clay-btn clay-btn-sm"
              onClick={() => batchScoreMut.mutate()}
              disabled={isScoring}
              style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: isScoring ? 'wait' : 'pointer' }}
            >
              {isScoring ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
              {isScoring ? 'Scoring...' : 'Score Investors'}
            </button>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="flex gap-3 mb-6">
        <div className="flex-1 relative">
          <Search
            size={16}
            style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
          />
          <input
            className="clay-input w-full"
            placeholder="Search investors by name, fund, or thesis..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: 44, width: '100%' }}
            id="discovery-search"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', cursor: 'pointer', background: 'none', border: 'none' }}
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      {searchLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 140, borderRadius: 20 }} />
          ))}
        </div>
      ) : results.length === 0 ? (
        <EmptyResults search={debouncedSearch} />
      ) : (
        <>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, fontWeight: 600 }}>
            {meta?.total || 0} investors {debouncedSearch ? `matching "${debouncedSearch}"` : ''} · sorted by match score
          </p>

          <div className="space-y-3">
            {results.map((result, idx) => (
              <ScoredInvestorCard key={result.investor.id} result={result} delay={idx} />
            ))}
          </div>

          {/* Pagination */}
          {meta && meta.totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 mt-8 mb-4">
              <button
                className="clay-btn-ghost clay-btn-sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                style={{ opacity: page <= 1 ? 0.4 : 1, cursor: page <= 1 ? 'default' : 'pointer' }}
              >
                <ChevronLeft size={16} />
              </button>
              <span className="tabular-nums" style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                Page {page} of {meta.totalPages}
              </span>
              <button
                className="clay-btn-ghost clay-btn-sm"
                disabled={page >= meta.totalPages}
                onClick={() => setPage((p) => p + 1)}
                style={{ opacity: page >= meta.totalPages ? 0.4 : 1, cursor: page >= meta.totalPages ? 'default' : 'pointer' }}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Profile Tag ──────────────────────────────────────────────────────────────

function ProfileTag({ label, value, color }: { label: string; value: string | null; color?: string }) {
  if (!value) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>{label}:</span>
      <span style={{
        fontSize: 12, fontWeight: 700,
        color: color || 'var(--text)',
        fontFamily: "'Manrope', system-ui, sans-serif",
      }}>{value}</span>
    </div>
  );
}

// ─── Startup Profile Form ─────────────────────────────────────────────────────

function StartupProfileForm({ initial, onComplete }: { initial: StartupProfile | null; onComplete: () => void }) {
  const [form, setForm] = useState({
    name: initial?.name || '',
    stage: initial?.stage || '',
    sector: initial?.sector || '',
    subSector: initial?.subSector || '',
    arrUsd: initial?.arrUsd ? String(initial.arrUsd) : '',
    geography: initial?.geography || '',
    raiseTargetUsd: initial?.raiseTargetUsd ? String(initial.raiseTargetUsd) : '',
    description: initial?.description || '',
  });
  const [saving, setSaving] = useState(false);

  const updateProfile = useMutation({
    mutationFn: () =>
      discoveryApi.updateProfile({
        name: form.name || null,
        stage: form.stage || null,
        sector: form.sector || null,
        subSector: form.subSector || null,
        arrUsd: form.arrUsd ? parseInt(form.arrUsd) : null,
        geography: form.geography || null,
        raiseTargetUsd: form.raiseTargetUsd ? parseInt(form.raiseTargetUsd) : null,
        description: form.description || null,
      } as any),
    onMutate: () => setSaving(true),
    onSuccess: () => {
      setSaving(false);
      onComplete();
    },
    onError: () => setSaving(false),
  });

  const isComplete = form.stage && form.sector && form.description;

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div
          style={{
            width: 64, height: 64, borderRadius: 20,
            background: 'linear-gradient(135deg, var(--primary), var(--accent))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
          }}
        >
          <Sparkles size={28} color="#fff" />
        </div>
        <h2 style={{
          fontSize: 24, fontWeight: 800,
          fontFamily: "'Manrope', system-ui, sans-serif",
          letterSpacing: '-0.02em', marginBottom: 8,
        }}>
          {initial ? 'Edit Startup Profile' : 'Set Up Your Startup Profile'}
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', maxWidth: 420, margin: '0 auto', lineHeight: 1.6 }}>
          We&#39;ll score investors based on how well they match your stage, sector, and thesis. The more detail you provide, the better the matches.
        </p>
      </div>

      <div className="clay-card" style={{ padding: 'var(--space-6)' }}>
        {/* Company name */}
        <FormField label="Company Name">
          <input
            className="clay-input w-full"
            placeholder="Acme Corp"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            style={{ width: '100%' }}
          />
        </FormField>

        {/* Stage */}
        <FormField label="Current Stage" required>
          <div className="flex flex-wrap gap-2">
            {STAGES.map((s) => (
              <button
                key={s}
                onClick={() => setForm({ ...form, stage: s })}
                style={{
                  padding: '8px 16px', borderRadius: 14, fontSize: 13, fontWeight: 600,
                  cursor: 'pointer', border: 'none', transition: 'all 0.15s ease',
                  background: form.stage === s ? (STAGE_COLORS[s] || 'var(--primary)') : 'var(--bg)',
                  color: form.stage === s ? '#fff' : 'var(--text-muted)',
                  boxShadow: form.stage === s ? `0 2px 12px ${STAGE_COLORS[s] || 'var(--primary)'}40` : 'var(--shadow-clay-sm)',
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </FormField>

        {/* Sector */}
        <FormField label="Primary Sector" required>
          <div className="flex flex-wrap gap-2">
            {SECTORS.map((s) => (
              <button
                key={s}
                onClick={() => setForm({ ...form, sector: s })}
                style={{
                  padding: '6px 14px', borderRadius: 12, fontSize: 12, fontWeight: 600,
                  cursor: 'pointer', border: 'none', transition: 'all 0.15s ease',
                  background: form.sector === s ? 'var(--primary)' : 'var(--bg)',
                  color: form.sector === s ? '#fff' : 'var(--text-muted)',
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </FormField>

        {/* Sub-sector */}
        <FormField label="Sub-sector">
          <input
            className="clay-input w-full"
            placeholder="e.g., Developer tools, Digital health, Climate analytics"
            value={form.subSector}
            onChange={(e) => setForm({ ...form, subSector: e.target.value })}
            style={{ width: '100%' }}
          />
        </FormField>

        {/* Geography + ARR side by side */}
        <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <FormField label="Headquarters">
            <input
              className="clay-input w-full"
              placeholder="San Francisco, CA"
              value={form.geography}
              onChange={(e) => setForm({ ...form, geography: e.target.value })}
              style={{ width: '100%' }}
            />
          </FormField>
          <FormField label="Annual Revenue (USD)">
            <input
              className="clay-input w-full"
              placeholder="500000"
              type="number"
              value={form.arrUsd}
              onChange={(e) => setForm({ ...form, arrUsd: e.target.value })}
              style={{ width: '100%' }}
            />
          </FormField>
        </div>

        {/* Raise target */}
        <FormField label="Target Raise Amount (USD)">
          <input
            className="clay-input w-full"
            placeholder="3000000"
            type="number"
            value={form.raiseTargetUsd}
            onChange={(e) => setForm({ ...form, raiseTargetUsd: e.target.value })}
            style={{ width: '100%' }}
          />
        </FormField>

        {/* Description — key for Claude thesis alignment */}
        <FormField label="Describe what your company does" required hint="This is used by AI to match you against investor theses. Be specific about your product, market, and differentiation.">
          <textarea
            className="clay-input w-full"
            placeholder="We build AI-powered infrastructure for..."
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={5}
            style={{ width: '100%', resize: 'vertical', fontFamily: "'Work Sans', system-ui, sans-serif" }}
          />
        </FormField>

        {/* Submit */}
        <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          {initial && (
            <button className="clay-btn-ghost" onClick={onComplete} style={{ cursor: 'pointer' }}>
              Cancel
            </button>
          )}
          <button
            className="clay-btn"
            disabled={!isComplete || saving}
            onClick={() => updateProfile.mutate()}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              opacity: isComplete ? 1 : 0.5, cursor: isComplete ? 'pointer' : 'not-allowed',
            }}
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            {initial ? 'Save Changes' : 'Start Discovering Investors'}
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

function FormField({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>
        {label}
        {required && <span style={{ color: 'var(--primary)', marginLeft: 4 }}>*</span>}
      </label>
      {hint && <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, lineHeight: 1.5 }}>{hint}</p>}
      {children}
    </div>
  );
}

// ─── Scored Investor Card ─────────────────────────────────────────────────────

function ScoredInvestorCard({ result, delay }: { result: ScoredInvestor; delay: number }) {
  const { investor, score, needsScoring } = result;
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="clay-card clay-card-hover animate-fade-in"
      style={{
        padding: 0, cursor: 'pointer', overflow: 'hidden',
        animationDelay: `${Math.min(delay * 0.04, 0.4)}s`,
        opacity: 0, animationFillMode: 'forwards',
      }}
      onClick={() => setExpanded(!expanded)}
    >
      <div style={{ display: 'flex', alignItems: 'stretch' }}>
        {/* Score column */}
        <div
          style={{
            width: 88, flexShrink: 0, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            padding: '16px 0',
            background: score
              ? `linear-gradient(180deg, ${getScoreColor(score.composite)}12, ${getScoreColor(score.composite)}04)`
              : 'var(--bg)',
          }}
        >
          {score ? (
            <>
              <span
                className="tabular-nums"
                style={{
                  fontSize: 28, fontWeight: 800,
                  fontFamily: "'Manrope', system-ui, sans-serif",
                  color: getScoreColor(score.composite),
                  lineHeight: 1,
                }}
              >
                {score.composite}
              </span>
              <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, marginTop: 2 }}>
                Match
              </span>
            </>
          ) : (
            <span style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', padding: '0 8px' }}>
              {needsScoring ? 'Not scored' : '—'}
            </span>
          )}
        </div>

        {/* Main content */}
        <div style={{ flex: 1, padding: '16px 20px' }}>
          <div className="flex items-start justify-between mb-1">
            <div className="flex items-center gap-3 min-w-0">
              <div
                style={{
                  width: 36, height: 36, borderRadius: 12,
                  background: 'linear-gradient(135deg, var(--primary), var(--accent))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontSize: 13, fontWeight: 700, flexShrink: 0,
                  fontFamily: "'Manrope', system-ui, sans-serif",
                }}
              >
                {investor.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', fontFamily: "'Manrope', system-ui, sans-serif" }}>
                  {investor.name}
                </p>
                <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {investor.fundName || investor.investorType || ''}
                </p>
              </div>
            </div>

            {/* Stage tags */}
            <div className="flex gap-1">
              {investor.stageFocus.slice(0, 2).map((s) => (
                <span key={s} style={{
                  padding: '2px 8px', borderRadius: 8, fontSize: 10, fontWeight: 600,
                  background: `${STAGE_COLORS[s] || '#888'}18`,
                  color: STAGE_COLORS[s] || '#888',
                }}>{s}</span>
              ))}
            </div>
          </div>

          {/* Thesis preview */}
          {investor.thesisSummary && (
            <p style={{
              fontSize: 12, lineHeight: 1.5, color: 'var(--text-muted)', marginTop: 6,
              display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden',
            }}>
              {investor.thesisSummary}
            </p>
          )}

          {/* Score breakdown mini */}
          {score && (
            <div className="flex gap-4 mt-2">
              <ScoreBadge label="Portfolio" value={score.portfolioFit} color="#10B981" />
              <ScoreBadge label="Thesis" value={score.thesisAlignment} color="#8B5CF6" />
              <ScoreBadge label="Warm Path" value={score.warmPath} color="#F59E0B" />
              <ScoreBadge label="Fund" value={getDeploymentScore(score.fundDeployment)} color="#3B82F6" />
            </div>
          )}

          {/* Bottom row */}
          <div className="flex items-center gap-4 mt-2" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            <span className="flex items-center gap-1">
              <DollarSign size={11} />
              {formatCheckSize(investor.typicalCheckMinUsd, investor.typicalCheckMaxUsd)}
            </span>
            {investor.geography.length > 0 && (
              <span className="flex items-center gap-1">
                <MapPin size={11} />
                {investor.geography[0]}
              </span>
            )}
            {investor.investmentCount18mo > 0 && (
              <span className="flex items-center gap-1">
                <TrendingUp size={11} />
                {investor.investmentCount18mo} deals
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Expanded view */}
      {expanded && score && (
        <div
          className="animate-fade-in"
          style={{
            padding: '16px 20px 20px', borderTop: '1px solid var(--border)',
            background: 'var(--bg)',
          }}
        >
          <h4 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Score Breakdown
          </h4>

          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
            {Object.entries(SCORE_LABELS).map(([key, config]) => {
              const val = key === 'fundDeployment'
                ? getDeploymentScore(score.fundDeployment)
                : (score as any)[key];
              return (
                <ScoreBarCard
                  key={key}
                  label={config.label}
                  icon={config.icon}
                  value={val}
                  color={config.color}
                />
              );
            })}
          </div>

          {/* Thesis reason */}
          {score.thesisReason && (
            <div className="clay-card-sm mt-3" style={{ padding: '10px 14px' }}>
              <div className="flex items-start gap-2">
                <Brain size={14} style={{ color: '#8B5CF6', marginTop: 2, flexShrink: 0 }} />
                <p style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--text)' }}>
                  {score.thesisReason}
                </p>
              </div>
            </div>
          )}

          {/* Warm path info */}
          {score.warmPathSummary && (
            <div className="clay-card-sm mt-2" style={{ padding: '10px 14px' }}>
              <div className="flex items-start gap-2">
                <Link2 size={14} style={{ color: '#F59E0B', marginTop: 2, flexShrink: 0 }} />
                <p style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--text)' }}>
                  {score.warmPathSummary}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Score helpers ─────────────────────────────────────────────────────────────

function ScoreBadge({ label, value, color }: { label: string; value: number | null; color: string }) {
  if (value === null || value === undefined) return null;
  return (
    <div className="flex items-center gap-1.5" style={{ fontSize: 11 }}>
      <div style={{ width: 24, height: 4, borderRadius: 2, background: `${color}20`, overflow: 'hidden' }}>
        <div style={{ width: `${value}%`, height: '100%', borderRadius: 2, background: color, transition: 'width 0.5s ease' }} />
      </div>
      <span className="tabular-nums" style={{ fontWeight: 600, color }}>{value}</span>
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
    </div>
  );
}

function ScoreBarCard({ label, icon, value, color }: { label: string; icon: React.ReactNode; value: number | null; color: string }) {
  const v = value ?? 0;
  return (
    <div className="clay-card-sm" style={{ padding: '12px', textAlign: 'center' }}>
      <div className="flex items-center justify-center gap-1 mb-2" style={{ color }}>
        {icon}
        <span style={{ fontSize: 11, fontWeight: 600 }}>{label}</span>
      </div>
      <p className="tabular-nums" style={{ fontSize: 22, fontWeight: 800, color, fontFamily: "'Manrope', system-ui, sans-serif" }}>
        {v}
      </p>
      <div style={{ height: 4, borderRadius: 2, background: `${color}15`, marginTop: 6 }}>
        <div style={{ width: `${v}%`, height: '100%', borderRadius: 2, background: color, transition: 'width 0.6s ease' }} />
      </div>
    </div>
  );
}

function getScoreColor(score: number): string {
  if (score >= 75) return '#10B981';
  if (score >= 50) return '#F59E0B';
  if (score >= 25) return '#EF4444';
  return '#9CA3AF';
}

function getDeploymentScore(status: string | null): number {
  if (!status) return 50;
  switch (status) {
    case 'active': return 80;
    case 'harvesting': return 20;
    default: return 50;
  }
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyResults({ search }: { search: string }) {
  return (
    <div className="clay-card animate-fade-in" style={{ textAlign: 'center', padding: '60px 40px', maxWidth: 480, margin: '40px auto' }}>
      <div style={{
        width: 64, height: 64, borderRadius: 20,
        background: 'linear-gradient(135deg, var(--primary), var(--accent))',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 20px',
      }}>
        <Sparkles size={28} color="#fff" />
      </div>
      <h3 style={{ fontSize: 18, fontWeight: 700, fontFamily: "'Manrope', system-ui, sans-serif", marginBottom: 8 }}>
        {search ? 'No investors found' : 'No scored investors yet'}
      </h3>
      <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6 }}>
        {search
          ? 'Try adjusting your search to find more investors.'
          : 'Click "Score Investors" above to run AI scoring against your investor database.'}
      </p>
    </div>
  );
}
