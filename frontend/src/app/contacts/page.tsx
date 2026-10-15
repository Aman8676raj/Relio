'use client';

import { useState, useEffect } from 'react';
import { Search, Plus, X, Loader2 } from 'lucide-react';
import { WarmthBadge } from '@/components/WarmthBadge';
import { AddContactModal } from '@/components/AddContactModal';
import type { WarmthTier } from '@/lib/types';
import { contactsApi, type ContactResponse } from '@/lib/api';
import Link from 'next/link';

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  return `${days}d ago`;
}

function getInitials(name: string | null, email: string): string {
  if (name) return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  return email[0].toUpperCase();
}

// ─── Skeleton Row ────────────────────────────────────────────────────────────

function SkeletonRows() {
  return (
    <>
      {[1, 2, 3, 4, 5, 6].map(i => (
        <tr key={i}>
          <td className="px-6 py-5"><div className="flex items-center gap-3"><div className="skeleton skeleton-avatar h-10 w-10 shrink-0" /><div className="space-y-2"><div className="skeleton h-3 w-32 rounded-lg" /><div className="skeleton h-2.5 w-48 rounded-lg" /></div></div></td>
          <td className="px-6 py-5"><div className="skeleton h-3 w-20 rounded-lg" /></td>
          <td className="px-6 py-5"><div className="skeleton h-6 w-16 rounded-lg" /></td>
          <td className="px-6 py-5"><div className="skeleton h-3 w-8 rounded-lg" /></td>
        </tr>
      ))}
    </>
  );
}

// ─── Avatar Colors ───────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  'linear-gradient(135deg, #D35C3E, #E8734F)',
  'linear-gradient(135deg, #E09A36, #F0B95D)',
  'linear-gradient(135deg, #2C5B6B, #3D7A8D)',
  'linear-gradient(135deg, #7B5EA7, #9E7FCB)',
  'linear-gradient(135deg, #2D8C5A, #45B77D)',
  'linear-gradient(135deg, #B33A27, #D25A45)',
];

function getAvatarColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function ContactsPage() {
  const [tab, setTab] = useState('Active'); // Default to Active
  const [contacts, setContacts] = useState<ContactResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState<string | undefined>();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  useEffect(() => {
    setLoading(true);
    const params: Record<string, string> = { sort: 'warmth_desc' };
    if (search) params.search = search;
    if (tierFilter) params.tier = tierFilter;
    
    // Pass archived parameter based on tab
    if (tab === 'Archive') params.archived = 'true';
    if (tab === 'Active') params.archived = 'false';
    // For 'All', we don't pass archived, so the backend returns all active+archived
    
    contactsApi.list(params)
      .then(res => setContacts(res.data))
      .finally(() => setLoading(false));
  }, [search, tierFilter, tab]);

  return (
    <div data-testid="contacts-page" className="flex-1 flex flex-col overflow-hidden px-4 py-2">
      <div className="clay-card flex-1 flex flex-col overflow-hidden" style={{ borderRadius: 24 }}>
        {/* Header */}
        <div className="px-8 pt-7 pb-5 shrink-0">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h1 className="text-3xl font-bold tracking-tight" style={{ color: 'var(--text)', fontFamily: 'var(--font-heading)' }}>Contacts</h1>
              <p className="text-[14px] mt-1" style={{ color: 'var(--text-muted)' }}>{contacts.length} contacts in your ledger</p>
            </div>
            <div className="flex items-center gap-3">
              {/* Tabs */}
              <div className="flex rounded-2xl p-1" style={{ background: 'var(--bg)', boxShadow: 'var(--shadow-inset)' }}>
                {['All', 'Active', 'Archive'].map(t => (
                  <button key={t} data-testid={`tab-${t.toLowerCase()}`} onClick={() => setTab(t)}
                    className="rounded-xl px-4 py-2 text-[13px] font-semibold transition-all duration-200"
                    style={{
                      background: tab === t ? 'var(--surface)' : 'transparent',
                      color: tab === t ? 'var(--text)' : 'var(--text-muted)',
                      boxShadow: tab === t ? 'var(--shadow-clay-sm)' : 'none',
                    }}
                  >{t}</button>
                ))}
              </div>
              <button 
                data-testid="add-contact-btn" 
                onClick={() => setIsAddModalOpen(true)}
                className="clay-btn clay-btn-sm flex items-center gap-2"
              >
                <Plus className="h-4 w-4" /> Add Contact
              </button>
            </div>
          </div>

          {/* Filters + Search */}
          <div className="flex items-center gap-3 mt-4">
            <div className="flex gap-2">
              {(['hot', 'warm', 'cold'] as const).map(tier => (
                <button key={tier} data-testid={`filter-${tier}`}
                  onClick={() => setTierFilter(tierFilter === tier ? undefined : tier)}
                  className="rounded-xl px-4 py-2 text-[12px] font-semibold transition-all duration-200"
                  style={{
                    background: tierFilter === tier ? 'var(--hot-bg)' : 'var(--surface)',
                    color: tierFilter === tier ? 'var(--primary)' : 'var(--text-muted)',
                    boxShadow: tierFilter === tier ? 'none' : 'var(--shadow-clay-sm)',
                    border: tierFilter === tier ? '1px solid rgba(211,92,62,0.2)' : '1px solid transparent',
                  }}
                >
                  {tierFilter === tier && <X className="h-3 w-3 inline mr-1" />}
                  {tier.charAt(0).toUpperCase() + tier.slice(1)}
                </button>
              ))}
            </div>
            <div className="ml-auto relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
              <input
                data-testid="contacts-search"
                type="search" placeholder="Search by name or email..." value={search}
                onChange={e => setSearch(e.target.value)}
                className="clay-input pl-10 pr-4 w-72 text-[13px]"
                style={{ borderRadius: 16, padding: '10px 16px 10px 40px' }}
              />
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          <table className="w-full" data-testid="contacts-table">
            <thead>
              <tr>
                {['Name & Email', 'Last Contacted', 'Warmth', 'Emails'].map(h => (
                  <th key={h} className="px-6 py-3 text-left text-[11px] font-bold tracking-[0.15em] uppercase" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', fontFamily: 'var(--font-heading)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? <SkeletonRows /> : contacts.length === 0 ? (
                <tr><td colSpan={4} className="py-16 text-center text-[14px]" style={{ color: 'var(--text-muted)' }}>{search ? 'No contacts match your search.' : 'No contacts yet.'}</td></tr>
              ) : contacts.map(contact => (
                <tr key={contact.id} data-testid={`contact-row-${contact.id}`}
                  className="cursor-pointer transition-all duration-200"
                  style={{ borderBottom: '1px solid var(--border)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                >
                  <td className="px-6 py-4">
                    <Link href={`/contacts/${contact.id}`} className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-white border-2 border-white"
                        style={{ background: getAvatarColor(contact.id), boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
                        {getInitials(contact.name, contact.email)}
                      </div>
                      <div>
                        <p className="text-[14px] font-semibold" style={{ color: 'var(--text)' }}>{contact.name || contact.email.split('@')[0]}</p>
                        <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>{contact.email}</p>
                      </div>
                    </Link>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-[14px]" style={{ color: 'var(--text-muted)' }}>{timeAgo(contact.lastContactedAt)}</p>
                    <p className="text-[12px]" style={{ color: 'var(--text-muted)', opacity: 0.6 }}>{contact.company || '—'}</p>
                  </td>
                  <td className="px-6 py-4"><WarmthBadge tier={contact.warmthTier as WarmthTier} /></td>
                  <td className="px-6 py-4 text-[14px] font-semibold tabular-nums" style={{ color: 'var(--text-muted)' }}>{contact.totalEmails}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Contact Modal */}
      {isAddModalOpen && (
        <AddContactModal 
          onClose={() => setIsAddModalOpen(false)} 
          onSuccess={() => {
            setIsAddModalOpen(false);
            // Refresh contacts
            const params: Record<string, string> = { sort: 'warmth_desc' };
            if (tab === 'Archive') params.archived = 'true';
            if (tab === 'Active') params.archived = 'false';
            contactsApi.list(params).then(res => setContacts(res.data));
          }}
        />
      )}
    </div>
  );
}

