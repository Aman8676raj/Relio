'use client';

import { useEffect, useState } from 'react';
import { CalendarCheck, ChevronRight, Eye, Clock, RefreshCw, CheckCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { meetingsApi } from '@/lib/api';

interface MeetingBrief {
  id: string;
  meetingAt: string;
  briefMarkdown: string | null;
  generatedAt: string;
  viewedAt: string | null;
  contact: { id: string; name: string | null; company: string | null; email: string };
}

function BriefCard({ brief, onView }: { brief: MeetingBrief; onView: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);

  const meetingDate = new Date(brief.meetingAt);
  const isToday = new Date().toDateString() === meetingDate.toDateString();
  const isPast = meetingDate < new Date();

  const initials = (brief.contact.name ?? brief.contact.email)
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div
      className="clay-card overflow-hidden"
      style={{
        borderLeft: isToday ? '4px solid var(--primary)' : '4px solid var(--border-strong)',
        opacity: isPast ? 0.7 : 1,
      }}
    >
      <div className="p-5 flex items-center gap-4">
        <div
          className="h-11 w-11 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
          style={{ background: 'linear-gradient(135deg, var(--primary), var(--accent))' }}
        >
          {initials}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-bold text-[15px] truncate" style={{ fontFamily: 'var(--font-heading)', color: 'var(--text)' }}>
              {brief.contact.name ?? brief.contact.email}
            </p>
            {isToday && (
              <span className="clay-btn-sm rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ background: 'rgba(211,92,62,0.1)', color: 'var(--primary)' }}>
                Today
              </span>
            )}
            {brief.viewedAt && <CheckCircle className="h-4 w-4 shrink-0" style={{ color: '#2D8C5A' }} />}
          </div>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {brief.contact.company && `${brief.contact.company} · `}
            {meetingDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            {' at '}
            {meetingDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
          </p>
        </div>

        <button
          className="clay-btn clay-btn-ghost clay-btn-sm flex items-center gap-1.5"
          onClick={() => {
            setExpanded(!expanded);
            if (!brief.viewedAt) onView(brief.id);
          }}
        >
          <Eye className="h-4 w-4" />
          {expanded ? 'Hide' : 'View Brief'}
        </button>
      </div>

      {expanded && brief.briefMarkdown && (
        <div
          className="px-5 pb-5 pt-1 border-t prose prose-sm max-w-none"
          style={{ borderColor: 'var(--border)' }}
        >
          <div
            className="text-sm leading-relaxed"
            style={{ color: 'var(--text)' }}
          >
            <ReactMarkdown
              components={{
                h2: ({ children }) => (
                  <h2 className="text-sm font-bold mt-4 mb-1.5" style={{ color: 'var(--text)', fontFamily: 'var(--font-heading)' }}>
                    {children}
                  </h2>
                ),
                p: ({ children }) => <p className="text-sm mb-2" style={{ color: 'var(--text)' }}>{children}</p>,
                ul: ({ children }) => <ul className="text-sm space-y-1 pl-4 mb-2">{children}</ul>,
                li: ({ children }) => <li className="list-disc" style={{ color: 'var(--text)' }}>{children}</li>,
                strong: ({ children }) => <strong className="font-semibold" style={{ color: 'var(--text)' }}>{children}</strong>,
              }}
            >
              {brief.briefMarkdown}
            </ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MeetingsPage() {
  const [briefs, setBriefs] = useState<MeetingBrief[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await meetingsApi.briefs();
      setBriefs(Array.isArray(data) ? data : []);
    } catch {
      setBriefs([]);
    } finally {
      setLoading(false);
    }
  };

  const syncCalendar = async () => {
    setSyncing(true);
    try {
      await meetingsApi.sync();
      await load();
    } finally {
      setSyncing(false);
    }
  };

  const markViewed = async (id: string) => {
    await meetingsApi.markViewed(id);
    setBriefs(prev => prev.map(b => b.id === id ? { ...b, viewedAt: new Date().toISOString() } : b));
  };

  useEffect(() => { load(); }, []);

  const upcoming = briefs.filter(b => new Date(b.meetingAt) >= new Date());
  const past = briefs.filter(b => new Date(b.meetingAt) < new Date());

  return (
    <div className="flex-1 overflow-y-auto" style={{ background: 'var(--bg)' }}>
      <div className="max-w-3xl mx-auto p-8 space-y-6">

        <div className="flex items-start justify-between animate-fade-in">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight" style={{ fontFamily: 'var(--font-heading)', color: 'var(--text)' }}>
              Pre-Meeting Briefs
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
              AI-generated intelligence for every investor meeting on your calendar
            </p>
          </div>
          <button
            className="clay-btn clay-btn-ghost clay-btn-sm flex items-center gap-2"
            onClick={syncCalendar}
            disabled={syncing}
          >
            <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing Calendar...' : 'Sync Calendar'}
          </button>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => <div key={i} className="clay-card h-20 animate-pulse" />)}
          </div>
        ) : briefs.length === 0 ? (
          <div className="clay-card p-10 text-center animate-fade-in">
            <CalendarCheck className="h-12 w-12 mx-auto mb-3" style={{ color: 'var(--primary)', opacity: 0.5 }} />
            <p className="font-bold text-lg" style={{ fontFamily: 'var(--font-heading)', color: 'var(--text)' }}>
              No meeting briefs yet
            </p>
            <p className="text-sm mt-2 mb-4" style={{ color: 'var(--text-muted)' }}>
              Sync your Google Calendar to auto-generate briefings for upcoming investor meetings.
            </p>
            <button className="clay-btn clay-btn-sm" onClick={syncCalendar}>
              Sync Calendar Now
            </button>
          </div>
        ) : (
          <>
            {upcoming.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                  Upcoming ({upcoming.length})
                </p>
                {upcoming.map(b => <BriefCard key={b.id} brief={b} onView={markViewed} />)}
              </div>
            )}
            {past.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider mt-4" style={{ color: 'var(--text-muted)' }}>
                  Past meetings ({past.length})
                </p>
                {past.map(b => <BriefCard key={b.id} brief={b} onView={markViewed} />)}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
