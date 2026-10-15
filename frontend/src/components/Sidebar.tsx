'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useState } from 'react';
import {
  LayoutDashboard, Users, GitBranch, Waypoints,
  FileText, Settings, LogOut, ChevronLeft, ChevronRight, Sparkles,
  Building2, Send, TrendingUp, Brain, CalendarCheck, BarChart3, Users2, Presentation,
} from 'lucide-react';

const NAV = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/contacts', label: 'Contacts', icon: Users },
  { href: '/pipeline', label: 'Pipeline', icon: GitBranch },
  { href: '/network', label: 'Network', icon: Waypoints },
  { href: '/investors', label: 'Investors', icon: Building2 },
  { href: '/discover', label: 'Discover', icon: Sparkles },
  { href: '/outreach', label: 'Outreach', icon: Send },
  { href: '/drafts', label: 'Drafts', icon: FileText },
  { href: '/forecast', label: 'Forecast', icon: TrendingUp },
  { href: '/meetings', label: 'Meetings', icon: CalendarCheck },
  { href: '/diagnostics', label: 'Diagnostics', icon: BarChart3 },
  { href: '/feature-intelligence', label: 'Feature AI', icon: Brain },
  { href: '/decks', label: 'Pitch Decks', icon: Presentation },
  { href: '/team', label: 'Team', icon: Users2 },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  const isActive = (href: string) =>
    href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(href);

  const userInitials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.[0]?.toUpperCase() || 'U';

  return (
    <aside
      data-testid="sidebar"
      className="flex flex-col m-3 rounded-3xl shrink-0 transition-all duration-300 relative overflow-hidden"
      style={{
        backgroundColor: 'var(--sidebar-bg)',
        width: collapsed ? 72 : 256,
        boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
      }}
    >
      {/* Logo */}
      <div className="flex items-center justify-between px-5 pt-6 pb-4">
        {!collapsed && (
          <div className="flex items-center gap-3">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-xl shrink-0"
              style={{ background: 'linear-gradient(135deg, var(--primary), #E8734F)' }}
            >
              <Sparkles className="h-4.5 w-4.5 text-white" strokeWidth={2} />
            </div>
            <div>
              <p className="text-[15px] font-bold tracking-tight" style={{ color: 'var(--sidebar-text)', fontFamily: 'var(--font-heading)' }}>Relio</p>
              <p className="text-[11px]" style={{ color: 'var(--sidebar-muted)' }}>Relationship Intelligence</p>
            </div>
          </div>
        )}
        {collapsed && (
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl mx-auto"
            style={{ background: 'linear-gradient(135deg, var(--primary), #E8734F)' }}
          >
            <Sparkles className="h-4.5 w-4.5 text-white" strokeWidth={2} />
          </div>
        )}
      </div>

      {/* Collapse toggle */}
      <button
        data-testid="sidebar-toggle"
        onClick={() => setCollapsed(!collapsed)}
        className="absolute top-6 transition-all duration-200 flex h-6 w-6 items-center justify-center rounded-full z-20"
        style={{
          right: collapsed ? '50%' : 16,
          transform: collapsed ? 'translateX(50%)' : 'none',
          top: collapsed ? 64 : 32,
          backgroundColor: 'rgba(255,255,255,0.08)',
          color: 'var(--sidebar-muted)',
        }}
      >
        {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
      </button>

      {/* Navigation */}
      <nav className="flex-1 px-3 mt-4 space-y-1" aria-label="Main navigation">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              data-testid={`nav-${label.toLowerCase()}`}
              className="relative flex items-center gap-3 rounded-2xl px-3 py-2.5 text-[14px] font-medium transition-all duration-200"
              style={{
                color: active ? '#ffffff' : 'var(--sidebar-muted)',
                backgroundColor: active ? 'var(--sidebar-active)' : 'transparent',
                justifyContent: collapsed ? 'center' : undefined,
              }}
              onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--sidebar-hover)'; }}
              onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
            >
              <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={active ? 2 : 1.5} />
              {!collapsed && <span>{label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="px-3 pb-4 space-y-1">
        <Link
          href="/settings"
          data-testid="nav-settings"
          className="flex items-center gap-3 rounded-2xl px-3 py-2.5 text-[14px] font-medium transition-colors duration-200"
          style={{
            color: isActive('/settings') ? '#ffffff' : 'var(--sidebar-muted)',
            backgroundColor: isActive('/settings') ? 'var(--sidebar-active)' : 'transparent',
            justifyContent: collapsed ? 'center' : undefined,
          }}
          onMouseEnter={e => { if (!isActive('/settings')) (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--sidebar-hover)'; }}
          onMouseLeave={e => { if (!isActive('/settings')) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
        >
          <Settings className="h-[18px] w-[18px] shrink-0" strokeWidth={1.5} />
          {!collapsed && <span>Settings</span>}
        </Link>

        <button
          data-testid="sign-out-btn"
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-[14px] font-medium transition-colors duration-200 text-left"
          style={{
            color: 'var(--sidebar-muted)',
            justifyContent: collapsed ? 'center' : undefined,
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--sidebar-hover)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
        >
          <LogOut className="h-[18px] w-[18px] shrink-0" strokeWidth={1.5} />
          {!collapsed && <span>Sign Out</span>}
        </button>

        {/* User card */}
        <div
          className="mt-2 flex items-center gap-3 rounded-2xl px-3 py-3"
          style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
          data-testid="user-card"
        >
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[12px] font-bold text-white"
            style={{ background: 'linear-gradient(135deg, var(--primary), var(--accent))' }}
          >
            {userInitials}
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold" style={{ color: 'var(--sidebar-text)' }}>
                {user?.name || user?.email?.split('@')[0]}
              </p>
              <p className="truncate text-[11px]" style={{ color: 'var(--sidebar-muted)' }}>
                Gmail Connected
              </p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
