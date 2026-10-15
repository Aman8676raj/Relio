'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, ChevronRight, CheckCircle2, Clock, MessageSquare, ArrowDownRight, RefreshCw, X } from 'lucide-react';
import { sentimentApi } from '@/lib/api';
import type { SentimentAlertResponse } from '@/lib/api';

interface SentimentAlert {
  id: string;
  alertType: string;
  summary: string;
  recommendedAction: string | null;
  createdAt: string;
  dismissedAt: string | null;
  contact: { id: string; name: string | null; company: string | null; email: string };
  snapshot: {
    degradingSignals: string[];
    avgReplyLatencyHours: number | null;
    avgReplyLengthWords: number | null;
  };
}

const SIGNAL_LABELS: Record<string, { label: string; icon: any }> = {
  reply_latency_increasing: { label: 'Slower replies', icon: Clock },
  reply_length_shrinking: { label: 'Shorter messages', icon: ArrowDownRight },
  forward_looking_language_absent: { label: 'No forward language', icon: MessageSquare },
  questions_becoming_generic: { label: 'Generic questions', icon: MessageSquare },
  proactive_contact_stopped: { label: 'Stopped reaching out', icon: X },
};

function SignalTag({ signal }: { signal: string }) {
  const meta = SIGNAL_LABELS[signal] ?? { label: signal, icon: AlertTriangle };
  const Icon = meta.icon;
  return (
    <span
      className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full"
      style={{ background: 'rgba(196,61,46,0.08)', color: 'var(--danger)' }}
    >
      <Icon className="h-3 w-3" />
      {meta.label}
    </span>
  );
}

function AlertCard({ alert, onDismiss }: { alert: SentimentAlert; onDismiss: (id: string) => void }) {
  const initials = (alert.contact.name ?? alert.contact.email)
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div
      className="clay-card p-5 space-y-4 clay-card-hover animate-fade-in"
      style={{ borderLeft: '4px solid var(--danger)' }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className="h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
            style={{ background: 'linear-gradient(135deg, var(--danger), #E07060)' }}
          >
            {initials}
          </div>
          <div>
            <p className="font-bold text-[15px]" style={{ fontFamily: 'var(--font-heading)', color: 'var(--text)' }}>
              {alert.contact.name ?? alert.contact.email}
            </p>
            {alert.contact.company && (
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{alert.contact.company}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span
            className="text-xs font-semibold px-2.5 py-1 rounded-full"
            style={{ background: 'rgba(196,61,46,0.08)', color: 'var(--danger)' }}
          >
            ⚠ Engagement declining
          </span>
          <button
            onClick={() => onDismiss(alert.id)}
            className="h-7 w-7 rounded-full flex items-center justify-center transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(42,35,31,0.06)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            title="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <p className="text-sm leading-relaxed" style={{ color: 'var(--text)' }}>{alert.summary}</p>

      {alert.snapshot.degradingSignals.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {alert.snapshot.degradingSignals.map(s => <SignalTag key={s} signal={s} />)}
        </div>
      )}

      {alert.recommendedAction && (
        <div
          className="rounded-xl p-3 flex items-start gap-2 text-sm"
          style={{ background: 'rgba(224,154,54,0.08)', border: '1px solid rgba(224,154,54,0.2)' }}
        >
          <ChevronRight className="h-4 w-4 mt-0.5 shrink-0" style={{ color: '#E09A36' }} />
          <p style={{ color: 'var(--text)' }}>{alert.recommendedAction}</p>
        </div>
      )}

      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
        Detected {new Date(alert.createdAt).toLocaleDateString()}
      </p>
    </div>
  );
}

export default function SentimentPage() {
  const [alerts, setAlerts] = useState<SentimentAlertResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await sentimentApi.alerts();
      setAlerts(Array.isArray(data) ? data : []);
    } catch {
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  };

  const runAnalysis = async () => {
    setRunning(true);
    try {
      await sentimentApi.run();
      await load();
    } finally {
      setRunning(false);
    }
  };

  const dismiss = async (id: string) => {
    await sentimentApi.dismiss(id);
    setAlerts(prev => prev.filter(a => a.id !== id));
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="flex-1 overflow-y-auto" style={{ background: 'var(--bg)' }}>
      <div className="max-w-3xl mx-auto p-8 space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between animate-fade-in">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight" style={{ fontFamily: 'var(--font-heading)', color: 'var(--text)' }}>
              Sentiment Monitoring
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
              Behavioral degradation detection — catches dying deals before you notice
            </p>
          </div>
          <button
            className="clay-btn clay-btn-ghost clay-btn-sm flex items-center gap-2"
            onClick={runAnalysis}
            disabled={running}
          >
            <RefreshCw className={`h-4 w-4 ${running ? 'animate-spin' : ''}`} />
            {running ? 'Analyzing...' : 'Run Analysis'}
          </button>
        </div>

        {/* How it works */}
        <div className="clay-card-sm p-4 flex gap-3 animate-fade-in stagger-1" style={{ background: 'rgba(224,154,54,0.06)', border: '1px solid rgba(224,154,54,0.15)' }}>
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" style={{ color: '#E09A36' }} />
          <p className="text-sm" style={{ color: 'var(--text)' }}>
            Alerts fire when <strong>3+ signals</strong> degrade simultaneously: reply latency increasing, messages
            getting shorter, forward-looking language disappearing, or questions becoming generic.
          </p>
        </div>

        {/* Alert list */}
        {loading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="clay-card h-36 animate-pulse" />
            ))}
          </div>
        ) : alerts.length === 0 ? (
          <div className="clay-card p-10 text-center animate-fade-in stagger-2">
            <CheckCircle2 className="h-12 w-12 mx-auto mb-3" style={{ color: '#2D8C5A' }} />
            <p className="font-bold text-lg" style={{ fontFamily: 'var(--font-heading)', color: 'var(--text)' }}>
              No active alerts
            </p>
            <p className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>
              All your active investor conversations look healthy. Run a manual analysis to check now.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              {alerts.length} active alert{alerts.length !== 1 ? 's' : ''}
            </p>
            {alerts.map(alert => (
              <AlertCard key={alert.id} alert={alert} onDismiss={dismiss} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
