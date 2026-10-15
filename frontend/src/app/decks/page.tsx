'use client';

import { useEffect, useState, useRef } from 'react';
import { Upload, Share2, Eye, BarChart3, Trash2, Plus, Link2, Clock, FileText, ChevronDown } from 'lucide-react';
import { decksApi } from '@/lib/api';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.relio.in';

interface DeckView { startedAt: string; completedAt: string | null; pagesViewed: number[]; }
interface DeckShare { id: string; shareToken: string; contactId?: string | null; expiresAt: string | null; views: DeckView[]; }
interface PitchDeck {
  id: string;
  filename: string;
  storageUrl: string;
  pageCount: number;
  createdAt: string;
  isActive: boolean;
  shares: DeckShare[];
}

interface DeckAnalytics {
  totalOpens: number;
  completedViews: number;
  avgViewTimeSeconds: number;
  pageEngagement: Record<number, number>;
  shareCount: number;
}

function formatTime(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function DeckCard({ deck, onShare, onDelete }: {
  deck: PitchDeck;
  onShare: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [analytics, setAnalytics] = useState<DeckAnalytics | null>(null);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const totalOpens = deck.shares.reduce((sum, s) => sum + s.views.length, 0);

  const loadAnalytics = async () => {
    if (showAnalytics && !analytics) {
      try {
        const data = await decksApi.analytics(deck.id);
        setAnalytics(data);
      } catch { /* ignore */ }
    }
    setShowAnalytics(!showAnalytics);
  };

  const copyLink = async (token: string) => {
    const url = `${APP_URL}/deck/${token}`;
    await navigator.clipboard.writeText(url);
    setCopied(token);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="clay-card overflow-hidden">
      <div className="p-5 flex items-center gap-4">
        <div
          className="h-12 w-12 rounded-2xl flex items-center justify-center shrink-0"
          style={{ background: 'linear-gradient(135deg, rgba(211,92,62,0.12), rgba(224,154,54,0.08))' }}
        >
          <FileText className="h-6 w-6" style={{ color: 'var(--primary)' }} />
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-bold text-[15px] truncate" style={{ fontFamily: 'var(--font-heading)', color: 'var(--text)' }}>
            {deck.filename}
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {deck.pageCount > 0 ? `${deck.pageCount} pages · ` : ''}
            {totalOpens} view{totalOpens !== 1 ? 's' : ''} · 
            {' '}{deck.shares.length} share link{deck.shares.length !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            className="clay-btn clay-btn-ghost clay-btn-sm flex items-center gap-1.5"
            onClick={() => onShare(deck.id)}
          >
            <Share2 className="h-4 w-4" />
            Share
          </button>
          <button
            className="clay-btn clay-btn-ghost clay-btn-sm flex items-center gap-1.5"
            onClick={loadAnalytics}
          >
            <BarChart3 className="h-4 w-4" />
            Analytics
            <ChevronDown className={`h-3 w-3 transition-transform ${showAnalytics ? 'rotate-180' : ''}`} />
          </button>
          <button
            className="h-8 w-8 rounded-full flex items-center justify-center transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onClick={() => onDelete(deck.id)}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(196,61,46,0.08)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Share links */}
      {deck.shares.length > 0 && (
        <div className="px-5 pb-3 border-t pt-3 space-y-2" style={{ borderColor: 'var(--border)' }}>
          {deck.shares.map(share => (
            <div key={share.id} className="flex items-center gap-2">
              <div
                className="flex-1 text-xs truncate px-3 py-1.5 rounded-xl font-mono"
                style={{ background: 'var(--bg)', color: 'var(--text-muted)' }}
              >
                {APP_URL}/deck/{share.shareToken}
              </div>
              <span className="text-xs tabular-nums" style={{ color: 'var(--text-muted)' }}>
                {share.views.length} opens
              </span>
              <button
                className="clay-btn-ghost clay-btn-sm rounded-xl px-3 py-1.5 text-xs font-medium flex items-center gap-1"
                onClick={() => copyLink(share.shareToken)}
                style={{ border: '1px solid var(--border-strong)', color: copied === share.shareToken ? '#2D8C5A' : 'var(--text)' }}
              >
                <Link2 className="h-3 w-3" />
                {copied === share.shareToken ? 'Copied!' : 'Copy'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Analytics panel */}
      {showAnalytics && analytics && (
        <div className="px-5 pb-5 pt-3 border-t space-y-4" style={{ borderColor: 'var(--border)', background: 'rgba(42,35,31,0.02)' }}>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Total opens', value: analytics.totalOpens },
              { label: 'Read fully', value: analytics.completedViews },
              { label: 'Avg view time', value: formatTime(analytics.avgViewTimeSeconds) },
            ].map(({ label, value }) => (
              <div key={label} className="clay-card-sm p-3 text-center">
                <p className="text-xl font-extrabold tabular-nums" style={{ fontFamily: 'var(--font-heading)', color: 'var(--text)' }}>{value}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{label}</p>
              </div>
            ))}
          </div>

          {Object.keys(analytics.pageEngagement).length > 0 && (
            <div>
              <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>Page engagement (seconds)</p>
              <div className="flex items-end gap-1 h-16">
                {Object.entries(analytics.pageEngagement)
                  .sort(([a], [b]) => Number(a) - Number(b))
                  .map(([page, secs]) => {
                    const maxSecs = Math.max(...Object.values(analytics.pageEngagement));
                    const height = (secs / maxSecs) * 100;
                    return (
                      <div
                        key={page}
                        className="flex-1 rounded-t-lg flex items-end justify-center text-[9px] font-medium"
                        style={{
                          height: `${height}%`,
                          minHeight: 4,
                          background: 'var(--primary)',
                          opacity: 0.4 + (height / 100) * 0.6,
                          color: 'white',
                          paddingTop: 2,
                        }}
                        title={`Page ${page}: ${secs}s`}
                      />
                    );
                  })
                }
              </div>
              <div className="flex justify-between text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
                <span>p.1</span>
                <span>p.{Math.max(...Object.keys(analytics.pageEngagement).map(Number))}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function DecksPage() {
  const [decks, setDecks] = useState<PitchDeck[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [shareModal, setShareModal] = useState<string | null>(null);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await decksApi.list();
      setDecks(Array.isArray(data) ? data : []);
    } catch {
      setDecks([]);
    } finally {
      setLoading(false);
    }
  };

  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await decksApi.upload(file);
      await load();
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const createShare = async (deckId: string) => {
    try {
      const data = await decksApi.createShare(deckId, undefined, 30);
      setShareLink(data.viewUrl);
      await load();
    } catch { /* ignore */ }
  };

  const deleteDeck = async (id: string) => {
    if (!confirm('Remove this deck?')) return;
    // Note: delete endpoint not yet implemented in API
    setDecks(prev => prev.filter(d => d.id !== id));
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="flex-1 overflow-y-auto" style={{ background: 'var(--bg)' }}>
      <div className="max-w-4xl mx-auto p-8 space-y-6">

        <div className="flex items-start justify-between animate-fade-in">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight" style={{ fontFamily: 'var(--font-heading)', color: 'var(--text)' }}>
              Pitch Deck Hosting
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
              Upload, share, and track exactly how investors engage with your deck
            </p>
          </div>
          <div>
            <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={upload} id="deck-upload" />
            <label
              htmlFor="deck-upload"
              className="clay-btn flex items-center gap-2 cursor-pointer"
              style={{ opacity: uploading ? 0.6 : 1 }}
            >
              {uploading ? (
                <><Upload className="h-4 w-4 animate-bounce" />Uploading...</>
              ) : (
                <><Plus className="h-4 w-4" />Upload Deck</>
              )}
            </label>
          </div>
        </div>

        {shareLink && (
          <div
            className="clay-card-sm p-4 flex items-center gap-3 animate-scale-in"
            style={{ background: 'rgba(45,140,90,0.06)', border: '1px solid rgba(45,140,90,0.2)' }}
          >
            <Link2 className="h-4 w-4 shrink-0" style={{ color: '#2D8C5A' }} />
            <p className="text-sm flex-1 font-mono truncate" style={{ color: 'var(--text)' }}>{shareLink}</p>
            <button
              className="clay-btn clay-btn-sm"
              onClick={() => { navigator.clipboard.writeText(shareLink); }}
            >
              Copy link
            </button>
            <button onClick={() => setShareLink(null)} className="text-xs" style={{ color: 'var(--text-muted)' }}>✕</button>
          </div>
        )}

        {loading ? (
          <div className="space-y-4">
            {[...Array(2)].map((_, i) => <div key={i} className="clay-card h-20 animate-pulse" />)}
          </div>
        ) : decks.length === 0 ? (
          <div className="clay-card p-12 text-center animate-fade-in">
            <div
              className="h-16 w-16 rounded-3xl mx-auto mb-4 flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, rgba(211,92,62,0.1), rgba(224,154,54,0.06))' }}
            >
              <FileText className="h-8 w-8" style={{ color: 'var(--primary)' }} />
            </div>
            <p className="font-bold text-xl mb-2" style={{ fontFamily: 'var(--font-heading)', color: 'var(--text)' }}>
              No decks uploaded yet
            </p>
            <p className="text-sm mb-5" style={{ color: 'var(--text-muted)' }}>
              Upload your pitch deck — then share unique tracked links with each investor.
            </p>
            <label htmlFor="deck-upload" className="clay-btn clay-btn-sm cursor-pointer inline-flex items-center gap-2">
              <Upload className="h-4 w-4" />Upload your first deck
            </label>
          </div>
        ) : (
          <div className="space-y-4">
            {decks.map(deck => (
              <DeckCard
                key={deck.id}
                deck={deck}
                onShare={createShare}
                onDelete={deleteDeck}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
