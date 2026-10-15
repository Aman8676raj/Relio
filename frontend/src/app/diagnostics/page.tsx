'use client';

import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Minus, BarChart3, RefreshCw, Sparkles, AlertCircle } from 'lucide-react';
import { diagnosticsApi } from '@/lib/api';

interface DiagnosticsReport {
  id: string;
  reportDate: string;
  dropoutByStage: Record<string, { entered: number; droppedOut: number; rate: number }>;
  topDropoutTopics: Array<{ topic: string; dropoutRate: number; note?: string }>;
  highPerformingPhrases: string[];
  lowPerformingPhrases: string[];
  velocityTrend: string;
  narrativeSummary: string | null;
}

const STAGE_LABELS: Record<string, string> = {
  intro: 'Intro',
  meeting: 'First Meeting',
  dd: 'Due Diligence',
  term_sheet: 'Term Sheet',
};

function VelocityBadge({ trend }: { trend: string }) {
  const config = {
    accelerating: { icon: TrendingUp, color: '#2D8C5A', bg: 'rgba(45,140,90,0.1)', label: 'Accelerating' },
    stable: { icon: Minus, color: '#E09A36', bg: 'rgba(224,154,54,0.1)', label: 'Stable' },
    decelerating: { icon: TrendingDown, color: 'var(--danger)', bg: 'rgba(196,61,46,0.1)', label: 'Decelerating' },
  }[trend] ?? { icon: Minus, color: 'var(--text-muted)', bg: 'rgba(42,35,31,0.05)', label: trend };

  const Icon = config.icon;

  return (
    <span
      className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1 rounded-full"
      style={{ background: config.bg, color: config.color }}
    >
      <Icon className="h-4 w-4" />
      {config.label}
    </span>
  );
}

function DropoutBar({ stage, data }: { stage: string; data: { entered: number; droppedOut: number; rate: number } }) {
  const pct = Math.round(data.rate * 100);
  const color = pct <= 30 ? '#2D8C5A' : pct <= 55 ? '#E09A36' : 'var(--danger)';

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center text-sm">
        <span className="font-medium" style={{ color: 'var(--text)' }}>{STAGE_LABELS[stage] ?? stage}</span>
        <span className="tabular-nums font-bold" style={{ color }}>
          {pct}% dropout
          <span className="ml-1.5 text-xs font-normal" style={{ color: 'var(--text-muted)' }}>({data.droppedOut}/{data.entered})</span>
        </span>
      </div>
      <div className="h-2 rounded-full" style={{ background: 'rgba(42,35,31,0.08)' }}>
        <div className="h-2 rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

export default function DiagnosticsPage() {
  const [report, setReport] = useState<DiagnosticsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await diagnosticsApi.latest();
      setReport(data);
    } catch {
      setReport(null);
    } finally {
      setLoading(false);
    }
  };

  const generate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const data = await diagnosticsApi.generate();
      setReport(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="flex-1 overflow-y-auto" style={{ background: 'var(--bg)' }}>
      <div className="max-w-3xl mx-auto p-8 space-y-6">

        <div className="flex items-start justify-between animate-fade-in">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight" style={{ fontFamily: 'var(--font-heading)', color: 'var(--text)' }}>
              Raise Diagnostics
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
              Weekly coaching — where your round is breaking down and why
            </p>
          </div>
          <button
            className="clay-btn clay-btn-ghost clay-btn-sm flex items-center gap-2"
            onClick={generate}
            disabled={generating}
          >
            <RefreshCw className={`h-4 w-4 ${generating ? 'animate-spin' : ''}`} />
            {generating ? 'Analyzing...' : 'Generate Report'}
          </button>
        </div>

        {error && (
          <div className="clay-card-sm p-4 flex gap-3" style={{ background: 'rgba(196,61,46,0.06)', border: '1px solid rgba(196,61,46,0.15)' }}>
            <AlertCircle className="h-4 w-4 mt-0.5" style={{ color: 'var(--danger)' }} />
            <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>
          </div>
        )}

        {loading ? (
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => <div key={i} className="clay-card h-24 animate-pulse" />)}
          </div>
        ) : !report ? (
          <div className="clay-card p-10 text-center animate-fade-in">
            <BarChart3 className="h-12 w-12 mx-auto mb-3" style={{ color: 'var(--primary)', opacity: 0.5 }} />
            <p className="font-bold text-lg" style={{ fontFamily: 'var(--font-heading)', color: 'var(--text)' }}>
              No report yet
            </p>
            <p className="text-sm mt-2 mb-4" style={{ color: 'var(--text-muted)' }}>
              Generate your first weekly coaching report to see where your round is breaking down.
            </p>
            <button className="clay-btn clay-btn-sm" onClick={generate} disabled={generating}>
              {generating ? 'Generating...' : 'Generate First Report'}
            </button>
          </div>
        ) : (
          <>
            {/* AI Narrative */}
            {report.narrativeSummary && (
              <div
                className="clay-card p-6 animate-fade-in stagger-1"
                style={{ background: 'linear-gradient(135deg, rgba(211,92,62,0.04), rgba(224,154,54,0.03))' }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="h-4 w-4" style={{ color: 'var(--primary)' }} />
                  <p className="text-sm font-bold" style={{ fontFamily: 'var(--font-heading)', color: 'var(--text)' }}>AI Coaching Insight</p>
                  <VelocityBadge trend={report.velocityTrend} />
                </div>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text)' }}>{report.narrativeSummary}</p>
              </div>
            )}

            {/* Stage dropout */}
            <div className="clay-card p-6 space-y-4 animate-fade-in stagger-2">
              <p className="text-sm font-bold" style={{ fontFamily: 'var(--font-heading)', color: 'var(--text)' }}>Stage Dropout Analysis</p>
              {Object.entries(report.dropoutByStage).map(([stage, data]) => (
                <DropoutBar key={stage} stage={stage} data={data} />
              ))}
            </div>

            {/* Topics in failed threads */}
            {report.topDropoutTopics?.length > 0 && (
              <div className="clay-card p-6 animate-fade-in stagger-3">
                <p className="text-sm font-bold mb-4" style={{ fontFamily: 'var(--font-heading)', color: 'var(--text)' }}>
                  Topics in Deals That Died
                </p>
                <div className="space-y-3">
                  {report.topDropoutTopics.map((item, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{item.topic}</p>
                        {item.note && <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{item.note}</p>}
                      </div>
                      <span
                        className="text-sm font-bold tabular-nums ml-4"
                        style={{ color: item.dropoutRate > 0.6 ? 'var(--danger)' : 'var(--text-muted)' }}
                      >
                        {Math.round(item.dropoutRate * 100)}% dropout
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Phrase performance */}
            <div className="grid grid-cols-2 gap-4 animate-fade-in stagger-4">
              <div className="clay-card p-5">
                <p className="text-xs uppercase tracking-wider font-semibold mb-3" style={{ color: '#2D8C5A' }}>✓ High-reply phrases</p>
                <ul className="space-y-2">
                  {(report.highPerformingPhrases ?? []).map((p, i) => (
                    <li key={i} className="text-sm px-3 py-2 rounded-xl" style={{ background: 'rgba(45,140,90,0.08)', color: 'var(--text)' }}>
                      "{p}"
                    </li>
                  ))}
                </ul>
              </div>
              <div className="clay-card p-5">
                <p className="text-xs uppercase tracking-wider font-semibold mb-3" style={{ color: 'var(--danger)' }}>✗ Low-reply phrases</p>
                <ul className="space-y-2">
                  {(report.lowPerformingPhrases ?? []).map((p, i) => (
                    <li key={i} className="text-sm px-3 py-2 rounded-xl" style={{ background: 'rgba(196,61,46,0.08)', color: 'var(--text)' }}>
                      "{p}"
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <p className="text-xs text-center pb-4" style={{ color: 'var(--text-muted)' }}>
              Report generated {new Date(report.reportDate).toLocaleDateString()}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
