'use client';

import { useState, useEffect } from 'react';
import { Sparkles, Send, Copy, CheckCircle2, Edit3, Loader2, FileText } from 'lucide-react';
import { WarmthBadge } from '@/components/WarmthBadge';
import type { WarmthTier } from '@/lib/types';
import { draftsApi, type DraftResponse } from '@/lib/api';

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function getInitials(name: string | null, email: string): string {
  if (name) return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  return email[0].toUpperCase();
}

function getDraftStatus(d: DraftResponse): 'ready' | 'sent' | 'editing' {
  if (d.wasSent) return 'sent';
  if (d.editedText) return 'editing';
  return 'ready';
}

const STATUS_CFG: Record<string, { label: string; color: string; bg: string; icon: typeof Sparkles }> = {
  ready: { label: 'Ready', color: 'var(--primary)', bg: 'var(--hot-bg)', icon: Sparkles },
  sent: { label: 'Sent', color: 'var(--success)', bg: 'var(--success-bg)', icon: CheckCircle2 },
  editing: { label: 'Editing', color: 'var(--accent)', bg: 'var(--warm-bg)', icon: Edit3 },
};

export default function DraftsPage() {
  const [drafts, setDrafts] = useState<DraftResponse[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [bodies, setBodies] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    draftsApi.list().then(res => {
      setDrafts(res.data);
      if (res.data.length > 0) {
        setSelectedId(res.data[0].id);
        const bm: Record<string, string> = {};
        res.data.forEach(d => { bm[d.id] = d.editedText || d.generatedText || ''; });
        setBodies(bm);
      }
    }).finally(() => setLoading(false));
  }, []);

  const selected = drafts.find(d => d.id === selectedId);
  const currentBody = selected ? (bodies[selected.id] ?? selected.generatedText ?? '') : '';
  const currentStatus = selected ? getDraftStatus(selected) : 'ready';

  const handleSend = async () => {
    if (!selected) return;
    try {
      await draftsApi.send(selected.id, currentBody);
      setDrafts(prev => prev.map(d => d.id === selected.id ? { ...d, wasSent: true } : d));
    } catch {}
  };

  if (loading) return <div className="flex h-full items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--primary)' }} /></div>;

  if (drafts.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center clay-card p-12" style={{ borderStyle: 'dashed', borderWidth: 2, borderColor: 'var(--border-strong)', background: 'transparent', boxShadow: 'none' }}>
          <FileText className="h-12 w-12 mx-auto mb-4" style={{ color: 'var(--text-muted)', opacity: 0.4 }} strokeWidth={1.5} />
          <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text)', fontFamily: 'var(--font-heading)' }}>No drafts yet</h2>
          <p className="text-[14px] max-w-sm" style={{ color: 'var(--text-muted)' }}>Drafts appear when you click "Draft Follow-up" from the Dashboard or Contacts.</p>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="drafts-page" className="flex h-full px-4 py-2 gap-4">
      {/* Draft List */}
      <div className="clay-card flex w-[360px] shrink-0 flex-col overflow-hidden" style={{ borderRadius: 24 }}>
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-center justify-between mb-1">
            <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text)', fontFamily: 'var(--font-heading)' }}>Drafts</h1>
            <span className="flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold" style={{ background: 'var(--hot-bg)', color: 'var(--primary)', fontFamily: 'var(--font-heading)' }}>
              <Sparkles className="h-3 w-3" /> {drafts.filter(d => !d.wasSent).length} pending
            </span>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-2">
          {drafts.map(draft => {
            const isSelected = selectedId === draft.id;
            const status = getDraftStatus(draft);
            const Ico = STATUS_CFG[status].icon;
            const contact = draft.contact;
            const contactName = contact?.name || contact?.email || 'Unknown';
            const initials = contact ? getInitials(contact.name ?? null, contact.email) : '?';
            return (
              <button key={draft.id} data-testid={`draft-${draft.id}`} onClick={() => setSelectedId(draft.id)}
                className="w-full text-left rounded-2xl p-4 transition-all duration-200"
                style={{
                  backgroundColor: isSelected ? 'var(--surface)' : 'transparent',
                  boxShadow: isSelected ? 'var(--shadow-clay-sm)' : 'none',
                }}
                onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg)'; }}
                onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.backgroundColor = isSelected ? 'var(--surface)' : 'transparent'; }}>
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[12px] font-bold text-white border-2 border-white"
                    style={{ background: 'linear-gradient(135deg, var(--primary), var(--accent))', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>{initials}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="text-[14px] font-semibold truncate" style={{ color: 'var(--text)' }}>{contactName}</p>
                      <span className="text-[11px] shrink-0" style={{ color: 'var(--text-muted)' }}>{timeAgo(draft.createdAt)}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      {contact && <WarmthBadge tier={(contact.warmthTier || 'frozen') as WarmthTier} />}
                      <span className="flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold"
                        style={{ backgroundColor: STATUS_CFG[status].bg, color: STATUS_CFG[status].color, fontFamily: 'var(--font-heading)' }}>
                        <Ico className="h-2.5 w-2.5" strokeWidth={2} /> {STATUS_CFG[status].label}
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Composer */}
      <div className="clay-card flex flex-1 flex-col overflow-hidden" style={{ borderRadius: 24 }}>
        {selected ? (
          <>
            <div className="flex items-center justify-between px-8 py-5 shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
              <div className="flex items-center gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-white border-2 border-white"
                  style={{ background: 'linear-gradient(135deg, var(--primary), var(--accent))' }}>
                  {selected.contact ? getInitials(selected.contact.name ?? null, selected.contact.email) : '?'}
                </div>
                <div>
                  <p className="text-[15px] font-semibold" style={{ color: 'var(--text)' }}>
                    To: {selected.contact?.name || 'Unknown'}
                    <span className="font-normal ml-2" style={{ color: 'var(--text-muted)' }}>&lt;{selected.contact?.email}&gt;</span>
                  </p>
                  <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>Generated {timeAgo(selected.createdAt)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button data-testid="copy-draft" className="clay-btn-ghost clay-btn-sm flex items-center gap-1.5 text-[13px]"
                  onClick={() => navigator.clipboard.writeText(currentBody)}>
                  <Copy className="h-3.5 w-3.5" /> Copy
                </button>
                <button data-testid="send-draft" onClick={handleSend} disabled={currentStatus === 'sent'}
                  className="clay-btn clay-btn-sm flex items-center gap-1.5 text-[13px] disabled:opacity-60">
                  {currentStatus === 'sent' ? <><CheckCircle2 className="h-4 w-4" /> Sent</> : <><Send className="h-4 w-4" /> Send via Gmail</>}
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-8 py-6">
              {currentStatus === 'sent' ? (
                <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full" style={{ backgroundColor: 'var(--success-bg)' }}>
                    <CheckCircle2 className="h-8 w-8" style={{ color: 'var(--success)' }} />
                  </div>
                  <p className="text-xl font-bold" style={{ color: 'var(--text)', fontFamily: 'var(--font-heading)' }}>Draft sent successfully</p>
                  <p className="text-[14px]" style={{ color: 'var(--text-muted)' }}>Delivered to {selected.contact?.email}</p>
                </div>
              ) : (
                <div className="rounded-2xl p-6" style={{ backgroundColor: 'var(--bg)', boxShadow: 'var(--shadow-inset)' }}>
                  <textarea data-testid="draft-body" className="w-full resize-none bg-transparent text-[15px] leading-relaxed outline-none"
                    style={{ color: 'var(--text)', minHeight: 400, lineHeight: '1.8' }} value={currentBody}
                    onChange={e => setBodies(prev => ({ ...prev, [selected.id]: e.target.value }))} />
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex h-full items-center justify-center">
            <p className="text-[14px]" style={{ color: 'var(--text-muted)' }}>Select a draft to preview</p>
          </div>
        )}
      </div>
    </div>
  );
}
