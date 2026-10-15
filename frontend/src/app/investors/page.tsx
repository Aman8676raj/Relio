'use client';

import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  investorsApi,
  type InvestorRecord,
  type InvestorFilterOptions,
} from '@/lib/api';
import {
  Search, SlidersHorizontal, X, Building2, MapPin, DollarSign,
  TrendingUp, Globe, Link2, ExternalLink, ChevronLeft,
  ChevronRight, Zap, BarChart3, Users,
} from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function formatFundSize(size: string | null): string {
  if (!size) return '—';
  const n = parseInt(size);
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(0)}M`;
  return `$${n}`;
}

const INVESTOR_TYPE_LABELS: Record<string, string> = {
  vc: 'Venture Capital',
  angel: 'Angel',
  family_office: 'Family Office',
  corporate: 'Corporate VC',
  accelerator: 'Accelerator',
};

const STAGE_COLORS: Record<string, string> = {
  'pre-seed': '#8B5CF6',
  'seed': '#F59E0B',
  'series-a': '#10B981',
  'series-b': '#3B82F6',
  'series-c': '#6366F1',
  'growth': '#EC4899',
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function InvestorsPage() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(true);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Reset page on filter/search change
  useEffect(() => { setPage(1); }, [debouncedSearch, filters]);

  // Build query params
  const queryParams = useCallback(() => {
    const params: Record<string, string> = { page: String(page), limit: '24' };
    if (debouncedSearch) params.search = debouncedSearch;
    Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
    return params;
  }, [page, debouncedSearch, filters]);

  // Fetch investors
  const { data, isLoading } = useQuery({
    queryKey: ['investors', page, debouncedSearch, filters],
    queryFn: () => investorsApi.list(queryParams()),
  });

  // Fetch filter options
  const { data: filterOptions } = useQuery({
    queryKey: ['investor-filters'],
    queryFn: () => investorsApi.filters(),
    staleTime: 5 * 60 * 1000,
  });

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ['investor-stats'],
    queryFn: () => investorsApi.stats(),
    staleTime: 5 * 60 * 1000,
  });

  // Fetch selected investor detail
  const { data: selectedInvestor } = useQuery({
    queryKey: ['investor', selectedId],
    queryFn: () => investorsApi.get(selectedId!),
    enabled: !!selectedId,
  });

  const investors = data?.data || [];
  const meta = data?.meta;

  return (
    <div className="flex h-full overflow-hidden" style={{ fontFamily: "'Work Sans', system-ui, sans-serif" }}>

      {/* Filter Sidebar */}
      {showFilters && (
        <aside
          className="shrink-0 overflow-y-auto animate-slide-left"
          style={{
            width: 280,
            padding: 'var(--space-5)',
            borderRight: '1px solid var(--border)',
          }}
        >
          <FilterPanel
            options={filterOptions}
            filters={filters}
            setFilters={setFilters}
          />
        </aside>
      )}

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto" style={{ padding: 'var(--space-6) var(--space-8)' }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1
              style={{
                fontSize: 28,
                fontWeight: 800,
                fontFamily: "'Manrope', system-ui, sans-serif",
                letterSpacing: '-0.02em',
                color: 'var(--text)',
              }}
            >
              Investor Directory
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 4 }}>
              {meta ? `${meta.total.toLocaleString()} investors` : 'Loading...'}
              {stats ? ` · ${stats.activelyDeploying.toLocaleString()} actively deploying` : ''}
            </p>
          </div>
        </div>

        {/* Stats Bar */}
        {stats && (
          <div
            className="flex gap-4 mb-6 animate-fade-in"
            style={{ overflowX: 'auto' }}
          >
            <StatChip icon={<Building2 size={15} />} label="Total" value={stats.total.toLocaleString()} />
            <StatChip icon={<Zap size={15} />} label="Deploying" value={stats.activelyDeploying.toLocaleString()} color="var(--success)" />
            <StatChip icon={<BarChart3 size={15} />} label="Avg Quality" value={`${stats.avgDataQuality}%`} />
            {stats.byType.slice(0, 3).map((t) => (
              <StatChip key={t.type} icon={<Users size={15} />} label={INVESTOR_TYPE_LABELS[t.type] || t.type} value={String(t.count)} />
            ))}
          </div>
        )}

        {/* Search + Filter Toggle */}
        <div className="flex gap-3 mb-6">
          <div className="flex-1 relative">
            <Search
              size={16}
              style={{
                position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
              }}
            />
            <input
              className="clay-input w-full"
              placeholder="Search investors, funds, thesis..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: 44, width: '100%' }}
              id="investor-search"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                style={{
                  position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
                  color: 'var(--text-muted)', cursor: 'pointer', background: 'none', border: 'none',
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>
          <button
            className="clay-btn-ghost"
            onClick={() => setShowFilters(!showFilters)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 20px', borderRadius: 16, fontSize: 13, fontWeight: 600,
              cursor: 'pointer', fontFamily: "'Manrope', system-ui, sans-serif",
            }}
          >
            <SlidersHorizontal size={15} />
            {showFilters ? 'Hide Filters' : 'Filters'}
          </button>
        </div>

        {/* Active Filters */}
        {Object.keys(filters).some((k) => filters[k]) && (
          <div className="flex flex-wrap gap-2 mb-4">
            {Object.entries(filters).map(([key, value]) =>
              value ? (
                <span
                  key={key}
                  className="clay-card-sm animate-scale-in"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '4px 12px', fontSize: 12, fontWeight: 600,
                    color: 'var(--primary)',
                  }}
                >
                  {key}: {value}
                  <button
                    onClick={() => setFilters((f) => ({ ...f, [key]: '' }))}
                    style={{ cursor: 'pointer', background: 'none', border: 'none', color: 'var(--text-muted)' }}
                  >
                    <X size={12} />
                  </button>
                </span>
              ) : null,
            )}
            <button
              onClick={() => setFilters({})}
              style={{
                fontSize: 12, color: 'var(--text-muted)', cursor: 'pointer',
                background: 'none', border: 'none', textDecoration: 'underline',
              }}
            >
              Clear all
            </button>
          </div>
        )}

        {/* Grid */}
        {isLoading ? (
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))' }}>
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 220, borderRadius: 20 }} />
            ))}
          </div>
        ) : investors.length === 0 ? (
          <EmptyState search={debouncedSearch} hasFilters={Object.keys(filters).some((k) => filters[k])} />
        ) : (
          <>
            <div
              className="grid gap-4"
              style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))' }}
            >
              {investors.map((investor, idx) => (
                <InvestorCard
                  key={investor.id}
                  investor={investor}
                  onClick={() => setSelectedId(investor.id)}
                  delay={idx}
                />
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

      {/* Detail Drawer */}
      {selectedId && selectedInvestor && (
        <InvestorDrawer investor={selectedInvestor} onClose={() => setSelectedId(null)} />
      )}
    </div>
  );
}

// ─── Stat Chip ────────────────────────────────────────────────────────────────

function StatChip({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color?: string }) {
  return (
    <div
      className="clay-card-sm"
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 16px', whiteSpace: 'nowrap',
      }}
    >
      <span style={{ color: color || 'var(--text-muted)' }}>{icon}</span>
      <div>
        <p className="tabular-nums" style={{ fontSize: 16, fontWeight: 700, color: color || 'var(--text)', fontFamily: "'Manrope', system-ui, sans-serif" }}>
          {value}
        </p>
        <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label}</p>
      </div>
    </div>
  );
}

// ─── Filter Panel ─────────────────────────────────────────────────────────────

function FilterPanel({
  options,
  filters,
  setFilters,
}: {
  options: InvestorFilterOptions | undefined;
  filters: Record<string, string>;
  setFilters: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}) {
  const updateFilter = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value === prev[key] ? '' : value }));
  };

  return (
    <div>
      <h3
        style={{
          fontSize: 13, fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 16,
          fontFamily: "'Manrope', system-ui, sans-serif",
        }}
      >
        Filters
      </h3>

      {/* Investor Type */}
      <FilterSection title="Investor Type">
        {(options?.investorTypes || ['vc', 'angel', 'family_office', 'corporate', 'accelerator']).map((t) => (
          <FilterChip
            key={t}
            label={INVESTOR_TYPE_LABELS[t] || t}
            active={filters.investorType === t}
            onClick={() => updateFilter('investorType', t)}
          />
        ))}
      </FilterSection>

      {/* Stage Focus */}
      <FilterSection title="Stage Focus">
        {(options?.stages || ['pre-seed', 'seed', 'series-a', 'series-b', 'growth']).map((s) => (
          <FilterChip
            key={s}
            label={s}
            active={filters.stageFocus === s}
            onClick={() => updateFilter('stageFocus', s)}
            color={STAGE_COLORS[s]}
          />
        ))}
      </FilterSection>

      {/* Sector Focus */}
      <FilterSection title="Sector">
        {(options?.sectors || []).slice(0, 15).map((s) => (
          <FilterChip
            key={s}
            label={s}
            active={filters.sectorFocus === s}
            onClick={() => updateFilter('sectorFocus', s)}
          />
        ))}
      </FilterSection>

      {/* Geography */}
      <FilterSection title="Geography">
        {(options?.geographies || []).slice(0, 12).map((g) => (
          <FilterChip
            key={g}
            label={g}
            active={filters.geography === g}
            onClick={() => updateFilter('geography', g)}
          />
        ))}
      </FilterSection>

      {/* Active Status */}
      <FilterSection title="Status">
        <FilterChip label="Actively Deploying" active={filters.activelyDeploying === 'true'} onClick={() => updateFilter('activelyDeploying', 'true')} color="var(--success)" />
      </FilterSection>
    </div>
  );
}

function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>
        {title}
      </p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function FilterChip({ label, active, onClick, color }: { label: string; active: boolean; onClick: () => void; color?: string }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '5px 12px',
        borderRadius: 12,
        fontSize: 12,
        fontWeight: 600,
        cursor: 'pointer',
        border: 'none',
        transition: 'all 0.15s ease',
        background: active ? (color || 'var(--primary)') : 'var(--bg)',
        color: active ? '#fff' : 'var(--text-muted)',
        boxShadow: active ? `0 2px 8px ${color || 'var(--primary)'}30` : 'var(--shadow-clay-sm)',
      }}
    >
      {label}
    </button>
  );
}

// ─── Investor Card ────────────────────────────────────────────────────────────

function InvestorCard({ investor, onClick, delay }: { investor: InvestorRecord; onClick: () => void; delay: number }) {
  return (
    <div
      className="clay-card clay-card-hover animate-fade-in"
      onClick={onClick}
      style={{
        padding: 'var(--space-5)',
        cursor: 'pointer',
        animationDelay: `${Math.min(delay * 0.03, 0.3)}s`,
        opacity: 0,
        animationFillMode: 'forwards',
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            style={{
              width: 42, height: 42, borderRadius: 14,
              background: `linear-gradient(135deg, var(--primary), var(--accent))`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontSize: 15, fontWeight: 700, flexShrink: 0,
              fontFamily: "'Manrope', system-ui, sans-serif",
            }}
          >
            {investor.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', fontFamily: "'Manrope', system-ui, sans-serif", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {investor.name}
            </p>
            {investor.fundName && (
              <p style={{ fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {investor.fundName}
              </p>
            )}
          </div>
        </div>

        {/* Deployment badge */}
        <span
          style={{
            padding: '3px 10px', borderRadius: 12, fontSize: 10, fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.04em', flexShrink: 0,
            background: investor.isActivelyDeploying ? 'var(--success-bg)' : 'var(--frozen-bg)',
            color: investor.isActivelyDeploying ? 'var(--success)' : 'var(--frozen-text)',
          }}
        >
          {investor.isActivelyDeploying ? 'Deploying' : 'Inactive'}
        </span>
      </div>

      {/* Thesis */}
      {investor.thesisSummary && (
        <p
          style={{
            fontSize: 12, lineHeight: 1.5, color: 'var(--text-muted)',
            marginBottom: 12, display: '-webkit-box', WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}
        >
          {investor.thesisSummary}
        </p>
      )}

      {/* Tags */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {investor.stageFocus.slice(0, 3).map((s) => (
          <span
            key={s}
            style={{
              padding: '2px 8px', borderRadius: 8, fontSize: 10, fontWeight: 600,
              background: `${STAGE_COLORS[s] || 'var(--text-muted)'}18`,
              color: STAGE_COLORS[s] || 'var(--text-muted)',
            }}
          >
            {s}
          </span>
        ))}
        {investor.sectorFocus.slice(0, 2).map((s) => (
          <span
            key={s}
            style={{
              padding: '2px 8px', borderRadius: 8, fontSize: 10, fontWeight: 600,
              background: 'var(--bg)',
              color: 'var(--text-muted)',
            }}
          >
            {s}
          </span>
        ))}
      </div>

      {/* Bottom row */}
      <div
        className="flex items-center gap-4"
        style={{ fontSize: 11, color: 'var(--text-muted)', borderTop: '1px solid var(--border)', paddingTop: 10 }}
      >
        <span className="flex items-center gap-1.5">
          <DollarSign size={12} />
          {formatCheckSize(investor.typicalCheckMinUsd, investor.typicalCheckMaxUsd)}
        </span>
        {investor.geography.length > 0 && (
          <span className="flex items-center gap-1.5">
            <MapPin size={12} />
            {investor.geography[0]}
            {investor.geography.length > 1 && ` +${investor.geography.length - 1}`}
          </span>
        )}
        {investor.investmentCount18mo > 0 && (
          <span className="flex items-center gap-1.5 ml-auto">
            <TrendingUp size={12} />
            {investor.investmentCount18mo} deals (18mo)
          </span>
        )}
      </div>

      {/* Quality bar */}
      <div style={{ marginTop: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)', marginBottom: 3 }}>
          <span>Data quality</span>
          <span className="tabular-nums">{investor.dataQualityScore}%</span>
        </div>
        <div style={{ height: 3, borderRadius: 2, background: 'var(--bg)' }}>
          <div
            style={{
              height: '100%', borderRadius: 2, width: `${investor.dataQualityScore}%`,
              background: investor.dataQualityScore > 70 ? 'var(--success)' : investor.dataQualityScore > 40 ? 'var(--accent)' : 'var(--danger)',
              transition: 'width 0.5s ease',
            }}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Investor Detail Drawer ───────────────────────────────────────────────────

function InvestorDrawer({ investor, onClose }: { investor: InvestorRecord; onClose: () => void }) {
  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.2)',
          zIndex: 40,
        }}
      />
      <aside
        className="animate-slide-right"
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0,
          width: 480, background: 'var(--surface)', zIndex: 50,
          boxShadow: '-8px 0 32px rgba(0,0,0,0.08)',
          overflowY: 'auto',
          padding: 'var(--space-6)',
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 20, right: 20,
            background: 'var(--bg)', borderRadius: '50%',
            width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
          }}
        >
          <X size={16} />
        </button>

        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <div
            style={{
              width: 56, height: 56, borderRadius: 18,
              background: 'linear-gradient(135deg, var(--primary), var(--accent))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontSize: 20, fontWeight: 700, flexShrink: 0,
              fontFamily: "'Manrope', system-ui, sans-serif",
            }}
          >
            {investor.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
          </div>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 800, fontFamily: "'Manrope', system-ui, sans-serif", color: 'var(--text)' }}>
              {investor.name}
            </h2>
            {investor.fundName && (
              <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>{investor.fundName}</p>
            )}
          </div>
        </div>

        {/* Quick Links */}
        <div className="flex gap-2 mb-6">
          {investor.website && (
            <a href={investor.website} target="_blank" rel="noopener noreferrer" className="clay-btn-ghost clay-btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, textDecoration: 'none', color: 'var(--text)' }}>
              <Globe size={13} /> Website
            </a>
          )}
          {investor.linkedinUrl && (
            <a href={investor.linkedinUrl} target="_blank" rel="noopener noreferrer" className="clay-btn-ghost clay-btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, textDecoration: 'none', color: 'var(--text)' }}>
              <Link2 size={13} /> LinkedIn
            </a>
          )}
          {investor.twitterHandle && (
            <a href={`https://x.com/${investor.twitterHandle}`} target="_blank" rel="noopener noreferrer" className="clay-btn-ghost clay-btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, textDecoration: 'none', color: 'var(--text)' }}>
              <ExternalLink size={13} /> X
            </a>
          )}
        </div>

        {/* Status badge */}
        <div className="clay-card-sm mb-4" style={{ padding: '12px 16px' }}>
          <div className="flex items-center justify-between">
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
              {investor.isActivelyDeploying ? '🟢 Actively Deploying' : '🔴 Not Deploying'}
            </span>
            {investor.investorType && (
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>
                {INVESTOR_TYPE_LABELS[investor.investorType] || investor.investorType}
              </span>
            )}
          </div>
        </div>

        {/* Fund Details */}
        <DrawerSection title="Fund Details">
          <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <DetailItem label="Fund Size" value={formatFundSize(investor.fundSizeUsd)} />
            <DetailItem label="Vintage Year" value={investor.fundVintageYear ? String(investor.fundVintageYear) : '—'} />
            <DetailItem label="Check Size" value={formatCheckSize(investor.typicalCheckMinUsd, investor.typicalCheckMaxUsd)} />
            <DetailItem label="Deals (18mo)" value={String(investor.investmentCount18mo)} />
          </div>
        </DrawerSection>

        {/* Focus Areas */}
        <DrawerSection title="Focus Areas">
          {investor.stageFocus.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>Stage</p>
              <div className="flex flex-wrap gap-1.5">
                {investor.stageFocus.map((s) => (
                  <span key={s} style={{ padding: '3px 10px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: `${STAGE_COLORS[s] || 'var(--text-muted)'}18`, color: STAGE_COLORS[s] || 'var(--text-muted)' }}>
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}
          {investor.sectorFocus.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>Sector</p>
              <div className="flex flex-wrap gap-1.5">
                {investor.sectorFocus.map((s) => (
                  <span key={s} style={{ padding: '3px 10px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: 'var(--bg)', color: 'var(--text-muted)' }}>
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}
          {investor.geography.length > 0 && (
            <div>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>Geography</p>
              <div className="flex flex-wrap gap-1.5">
                {investor.geography.map((g) => (
                  <span key={g} style={{ padding: '3px 10px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: 'var(--bg)', color: 'var(--text-muted)' }}>
                    <MapPin size={10} style={{ display: 'inline', marginRight: 3, verticalAlign: 'text-bottom' }} />{g}
                  </span>
                ))}
              </div>
            </div>
          )}
        </DrawerSection>

        {/* Thesis */}
        {investor.thesisSummary && (
          <DrawerSection title="Investment Thesis">
            <p style={{ fontSize: 13, lineHeight: 1.65, color: 'var(--text)' }}>
              {investor.thesisSummary}
            </p>
          </DrawerSection>
        )}

        {/* Recent Investments */}
        {investor.recentInvestments && Array.isArray(investor.recentInvestments) && investor.recentInvestments.length > 0 && (
          <DrawerSection title="Recent Investments">
            <div className="space-y-2">
              {investor.recentInvestments.slice(0, 6).map((inv: any, i: number) => (
                <div
                  key={i}
                  className="clay-card-sm"
                  style={{ padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{inv.company}</p>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {inv.stage || ''} {inv.sector ? `· ${inv.sector}` : ''}
                    </p>
                  </div>
                  {inv.date && (
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {new Date(inv.date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </DrawerSection>
        )}

        {/* Data Quality */}
        <DrawerSection title="Data Quality">
          <div style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
              <span style={{ color: 'var(--text-muted)' }}>Completeness</span>
              <span className="tabular-nums" style={{ fontWeight: 600, color: 'var(--text)' }}>{investor.dataQualityScore}%</span>
            </div>
            <div style={{ height: 6, borderRadius: 3, background: 'var(--bg)' }}>
              <div
                style={{
                  height: '100%', borderRadius: 3, width: `${investor.dataQualityScore}%`,
                  background: investor.dataQualityScore > 70 ? 'var(--success)' : investor.dataQualityScore > 40 ? 'var(--accent)' : 'var(--danger)',
                  transition: 'width 0.6s ease',
                }}
              />
            </div>
          </div>
          {investor.lastEnrichedAt && (
            <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              Last enriched: {new Date(investor.lastEnrichedAt).toLocaleDateString()}
            </p>
          )}
        </DrawerSection>

        {/* Add to Pipeline CTA */}
        <div style={{ marginTop: 24, padding: '0 0 24px' }}>
          <button
            className="clay-btn w-full"
            style={{ width: '100%', textAlign: 'center', fontSize: 14 }}
          >
            Add to Pipeline
          </button>
        </div>
      </aside>
    </>
  );
}

// ─── Drawer helpers ───────────────────────────────────────────────────────────

function DrawerSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <h4 style={{
        fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 10,
        fontFamily: "'Manrope', system-ui, sans-serif",
      }}>
        {title}
      </h4>
      {children}
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>{label}</p>
      <p className="tabular-nums" style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{value}</p>
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ search, hasFilters }: { search: string; hasFilters: boolean }) {
  return (
    <div
      className="clay-card animate-fade-in"
      style={{
        textAlign: 'center', padding: '60px 40px', maxWidth: 480,
        margin: '40px auto',
      }}
    >
      <div
        style={{
          width: 64, height: 64, borderRadius: 20,
          background: 'linear-gradient(135deg, var(--primary), var(--accent))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 20px',
        }}
      >
        <Building2 size={28} color="#fff" />
      </div>
      <h3 style={{ fontSize: 18, fontWeight: 700, fontFamily: "'Manrope', system-ui, sans-serif", marginBottom: 8 }}>
        {search || hasFilters ? 'No investors found' : 'No investors yet'}
      </h3>
      <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6 }}>
        {search || hasFilters
          ? 'Try adjusting your search or filters to find more investors.'
          : 'Seed your investor database to get started. You can import investor data from Crunchbase or other sources.'}
      </p>
    </div>
  );
}
