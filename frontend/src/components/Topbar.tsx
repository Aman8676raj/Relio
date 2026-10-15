'use client';

import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Bell, Command, Search } from 'lucide-react';

const PAGE_LABELS: Record<string, string> = {
  '/': 'Overview',
  '/contacts': 'Contacts',
  '/pipeline': 'Pipeline',
  '/network': 'Network',
  '/drafts': 'Drafts',
  '/settings': 'Settings',
};

export function Topbar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const label = PAGE_LABELS[pathname] ?? PAGE_LABELS[Object.keys(PAGE_LABELS).find(k => k !== '/' && pathname.startsWith(k)) || ''] ?? 'Relio';

  const initials = user?.name
    ? user.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.[0]?.toUpperCase() || '?';

  return (
    <header
      data-testid="topbar"
      className="clay-card-sm flex h-14 items-center justify-between px-6 mx-4 mt-3 mb-2 shrink-0"
      style={{ borderRadius: 16 }}
    >
      {/* Left: Breadcrumb */}
      <span
        className="text-[11px] font-bold tracking-[0.2em] uppercase"
        style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-heading)' }}
      >
        {label}
      </span>

      {/* Center: Search */}
      <div className="flex flex-1 max-w-sm mx-8">
        <div
          className="flex w-full items-center gap-2.5 rounded-2xl px-4 py-2"
          style={{ background: 'var(--bg)', boxShadow: 'var(--shadow-inset)' }}
        >
          <Search className="h-4 w-4 shrink-0" style={{ color: 'var(--text-muted)', opacity: 0.5 }} strokeWidth={1.5} />
          <input
            data-testid="global-search"
            type="search"
            placeholder="Search relationships..."
            className="flex-1 bg-transparent text-[14px] outline-none"
            style={{ color: 'var(--text)', fontFamily: 'var(--font-body)' }}
          />
          <kbd
            className="hidden sm:flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-medium"
            style={{ background: 'var(--surface)', color: 'var(--text-muted)', boxShadow: 'var(--shadow-clay-sm)' }}
          >
            <Command className="h-2.5 w-2.5" />K
          </kbd>
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        <button
          data-testid="notifications-btn"
          className="flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-200"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.background = 'var(--bg)';
            (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-clay-sm)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.background = 'transparent';
            (e.currentTarget as HTMLElement).style.boxShadow = 'none';
          }}
        >
          <Bell className="h-[18px] w-[18px]" strokeWidth={1.5} />
        </button>

        {/* Avatar */}
        <div
          data-testid="user-avatar"
          className="flex h-9 w-9 items-center justify-center rounded-full text-[12px] font-bold text-white cursor-pointer border-2 border-white"
          style={{ background: 'linear-gradient(135deg, var(--primary), var(--accent))', boxShadow: '0 2px 8px rgba(211,92,62,0.25)' }}
          title={user?.name || user?.email || 'User'}
        >
          {initials}
        </div>
      </div>
    </header>
  );
}
