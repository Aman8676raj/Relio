'use client';

import { useParams } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import { contactsApi, briefingApi, type ContactDetailResponse, type BriefingResponse } from '@/lib/api';
import { WarmthBadge } from '@/components/WarmthBadge';
import type { WarmthTier } from '@/lib/types';
import Link from 'next/link';
import { ArrowLeft, Mail, Clock, BarChart3, MessageSquare, Loader2, Brain, ChevronRight } from 'lucide-react';

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return `${days}d ago`;
}

const STAGES = [
  { value: 'none', label: 'None' }, { value: 'intro', label: 'Intro' },
  { value: 'meeting', label: 'Meeting' }, { value: 'dd', label: 'Due Diligence' },
  { value: 'term_sheet', label: 'Term Sheet' }, { value: 'closed_won', label: 'Won' },
  { value: 'closed_lost', label: 'Lost' }, { value: 'paused', label: 'Paused' },
];

export default function ContactDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [contact, setContact] = useState<ContactDetailResponse | null>(null);
  const [briefing, setBriefing] = useState<BriefingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    Promise.all([
      contactsApi.get(id).then(c => { setContact(c); setNotes(c.notes || ''); }),
      briefingApi.get(id).then(setBriefing).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--primary)' }} /></div>;
  if (!contact) return <div className="py-20 text-center" style={{ color: 'var(--text-muted)' }}>Contact not found</div>;

  const daysAgo = contact.lastContactedAt ? Math.floor((Date.now() - new Date(contact.lastContactedAt).getTime()) / 86400000) : null;

  return (
    <div data-testid="contact-detail-page" className="flex-1 overflow-y-auto px-4 py-2">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Back */}
        <Link href="/contacts" data-testid="back-to-contacts" className="inline-flex items-center gap-2 text-[13px] font-medium transition-colors rounded-xl px-3 py-2" style={{ color: 'var(--text-muted)' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}>
          <ArrowLeft className="h-4 w-4" /> Back to contacts
        </Link>

        {/* Header Card */}
        <div className="clay-card p-8">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-5">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl text-2xl font-bold text-white border-2 border-white"
                style={{ background: 'linear-gradient(135deg, var(--primary), var(--accent))', boxShadow: 'var(--shadow-button)' }}>
                {(contact.name || contact.email).charAt(0).toUpperCase()}
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text)', fontFamily: 'var(--font-heading)' }}>{contact.name || contact.email}</h1>
                <p className="text-[14px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{contact.company || 'No company'} &middot; {contact.email}</p>
              </div>
            </div>
            <WarmthBadge tier={contact.warmthTier as WarmthTier} size="md" />
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            {[
              { icon: Clock, label: 'Last Contact', value: daysAgo !== null ? `${daysAgo}d ago` : 'Never' },
              { icon: Mail, label: 'Total Emails', value: contact.totalEmails },
              { icon: BarChart3, label: 'Reply Rate', value: `${Math.round(contact.replyRate * 100)}%` },
              { icon: MessageSquare, label: 'Avg Depth', value: contact.avgThreadDepth.toFixed(1) },
            ].map(stat => (
              <div key={stat.label} className="rounded-2xl p-4" style={{ backgroundColor: 'var(--bg)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <stat.icon className="h-4 w-4" style={{ color: 'var(--text-muted)' }} />
                  <span className="text-[11px] font-bold tracking-[0.15em] uppercase" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-heading)' }}>{stat.label}</span>
                </div>
                <p className="text-xl font-bold tabular-nums" style={{ color: 'var(--text)', fontFamily: 'var(--font-heading)' }}>{stat.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* AI Briefing */}
          {briefing && (
            <div className="clay-card p-6">
              <div className="flex items-center gap-2 mb-4">
                <Brain className="h-4 w-4" style={{ color: 'var(--primary)' }} />
                <span className="text-[11px] font-bold tracking-[0.2em] uppercase" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-heading)' }}>AI Briefing</span>
              </div>
              <p className="text-[14px] leading-relaxed mb-4" style={{ color: 'var(--text)' }}>{briefing.summary}</p>
              {briefing.keyFacts.length > 0 && (
                <div className="space-y-2 mb-4">
                  <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Key Facts</p>
                  {briefing.keyFacts.map((f, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <ChevronRight className="h-3 w-3 mt-1 shrink-0" style={{ color: 'var(--primary)' }} />
                      <span className="text-[13px]" style={{ color: 'var(--text-muted)' }}>{f}</span>
                    </div>
                  ))}
                </div>
              )}
              {briefing.commitments.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Commitments</p>
                  {briefing.commitments.map((c, i) => (
                    <div key={i} className="flex items-center gap-2 rounded-xl px-3 py-2" style={{ backgroundColor: c.status === 'completed' ? 'var(--success-bg)' : 'var(--bg)' }}>
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: c.status === 'completed' ? 'var(--success)' : c.direction === 'inbound' ? 'var(--accent)' : 'var(--primary)' }} />
                      <span className="text-[13px] flex-1" style={{ color: 'var(--text)', textDecoration: c.status === 'completed' ? 'line-through' : 'none', opacity: c.status === 'completed' ? 0.6 : 1 }}>{c.text}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Notes + Pipeline */}
          <div className="space-y-6">
            <div className="clay-card p-6">
              <span className="text-[11px] font-bold tracking-[0.2em] uppercase" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-heading)' }}>Pipeline Stage</span>
              <div className="flex flex-wrap gap-2 mt-4">
                {STAGES.map(s => (
                  <button key={s.value} data-testid={`stage-${s.value}`} className="rounded-xl px-4 py-2 text-[12px] font-semibold transition-all"
                    style={{
                      background: contact.pipelineStage === s.value ? 'var(--hot-bg)' : 'var(--bg)',
                      color: contact.pipelineStage === s.value ? 'var(--primary)' : 'var(--text-muted)',
                      border: contact.pipelineStage === s.value ? '1px solid rgba(211,92,62,0.2)' : '1px solid transparent',
                    }}>{s.label}</button>
                ))}
              </div>
            </div>

            <div className="clay-card p-6">
              <span className="text-[11px] font-bold tracking-[0.2em] uppercase mb-3 block" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-heading)' }}>Notes</span>
              <textarea data-testid="contact-notes" value={notes} onChange={e => setNotes(e.target.value)} rows={4}
                className="clay-input w-full resize-none text-[14px]" placeholder="Add private notes about this contact..." />
            </div>

            {/* Recent Threads */}
            {contact.threads && contact.threads.length > 0 && (
              <div className="clay-card p-6">
                <span className="text-[11px] font-bold tracking-[0.2em] uppercase mb-4 block" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-heading)' }}>Recent Threads</span>
                <div className="space-y-3">
                  {contact.threads.map(thread => (
                    <div key={thread.id} className="rounded-2xl p-4 transition-colors" style={{ backgroundColor: 'var(--bg)' }}>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <h3 className="truncate text-[14px] font-semibold" style={{ color: 'var(--text)' }}>{thread.subject || '(no subject)'}</h3>
                        <span className="shrink-0 text-[11px] font-medium tabular-nums" style={{ color: 'var(--text-muted)' }}>{thread.messageCount} msgs</span>
                      </div>
                      {thread.snippet && <p className="truncate text-[12px]" style={{ color: 'var(--text-muted)' }}>{thread.snippet}</p>}
                      <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)', opacity: 0.6 }}>{timeAgo(thread.lastMessageAt)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
