'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useSubscription } from '@/context/SubscriptionContext';
import { settingsApi, syncApi, billingApi, type SettingsResponse, type Plan } from '@/lib/api';
import {
  Mail, Bell, User, Shield, Zap, ChevronRight, ToggleLeft, ToggleRight,
  Loader2, CheckCircle2, AlertTriangle, Camera, Globe, Clock, Sparkles,
  Palette, MessageSquare, Key, Monitor, Trash2, ExternalLink, Crown, RefreshCw,
} from 'lucide-react';

type Section = 'account' | 'integrations' | 'notifications' | 'ai' | 'security';

const SECTIONS: { id: Section; label: string; desc: string; icon: typeof User }[] = [
  { id: 'account', label: 'Account', desc: 'Profile & preferences', icon: User },
  { id: 'integrations', label: 'Integrations', desc: 'Connected services', icon: Mail },
  { id: 'notifications', label: 'Notifications', desc: 'Alerts & digests', icon: Bell },
  { id: 'ai', label: 'AI & Drafts', desc: 'Writing assistant', icon: Sparkles },
  { id: 'security', label: 'Security', desc: 'Password & sessions', icon: Shield },
];

// ─── Toggle ──────────────────────────────────────────────────────────────────

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button data-testid={`toggle-${label?.toLowerCase().replace(/\s+/g, '-') || 'default'}`} onClick={() => onChange(!on)}
      className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200"
      style={{ backgroundColor: on ? 'var(--primary)' : 'var(--border-strong)' }}>
      <span className="inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200"
        style={{ transform: on ? 'translateX(24px)' : 'translateX(4px)' }} />
    </button>
  );
}

// ─── Section Card ────────────────────────────────────────────────────────────

function Card({ title, desc, children, icon: Icon }: { title: string; desc?: string; children: React.ReactNode; icon?: typeof User }) {
  return (
    <div className="clay-card overflow-hidden" style={{ borderRadius: 24 }}>
      <div className="px-7 pt-6 pb-4 flex items-center gap-3">
        {Icon && (
          <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: 'var(--hot-bg)' }}>
            <Icon className="h-4 w-4" style={{ color: 'var(--primary)' }} />
          </div>
        )}
        <div>
          <h3 className="text-[16px] font-bold" style={{ color: 'var(--text)', fontFamily: 'var(--font-heading)' }}>{title}</h3>
          {desc && <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{desc}</p>}
        </div>
      </div>
      <div style={{ borderTop: '1px solid var(--border)' }}>{children}</div>
    </div>
  );
}

function Row({ label, desc, children }: { label: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6 px-7 py-5" style={{ borderBottom: '1px solid var(--border)' }}>
      <div>
        <p className="text-[14px] font-semibold" style={{ color: 'var(--text)' }}>{label}</p>
        {desc && <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{desc}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

// ─── Account Section ─────────────────────────────────────────────────────────

function AccountSection({ settings }: { settings: SettingsResponse }) {
  const { user } = useAuth();
  const name = settings.profile.name || user?.name || '';
  const email = settings.profile.email || user?.email || '';
  const initials = name ? name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) : email[0]?.toUpperCase() || '?';
  const joinedDate = new Date(settings.profile.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-6">
      {/* Profile hero */}
      <div className="clay-card p-8 flex items-center gap-6" style={{ borderRadius: 24 }}>
        <div className="relative group">
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl text-2xl font-extrabold text-white border-3 border-white"
            style={{ background: 'linear-gradient(135deg, var(--primary), var(--accent))', boxShadow: 'var(--shadow-button)' }}>
            {initials}
          </div>
          <button className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-white transition-transform hover:scale-110"
            style={{ boxShadow: 'var(--shadow-clay-sm)' }}>
            <Camera className="h-3.5 w-3.5" style={{ color: 'var(--text-muted)' }} />
          </button>
        </div>
        <div>
          <h2 className="text-xl font-bold" style={{ color: 'var(--text)', fontFamily: 'var(--font-heading)' }}>{name || 'Set your name'}</h2>
          <p className="text-[14px]" style={{ color: 'var(--text-muted)' }}>{email}</p>
          <p className="text-[12px] mt-1 flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
            <Clock className="h-3 w-3" /> Member since {joinedDate}
          </p>
        </div>
        <button className="ml-auto clay-btn clay-btn-sm text-[13px]">Edit Profile</button>
      </div>

      <Card title="Personal Info" icon={User}>
        <Row label="Full Name" desc="Visible to your team">
          <input className="clay-input text-[14px] w-56 text-right" defaultValue={name} style={{ borderRadius: 12, padding: '8px 14px' }} />
        </Row>
        <Row label="Email Address" desc="Used for login & notifications">
          <input className="clay-input text-[14px] w-56 text-right" defaultValue={email} style={{ borderRadius: 12, padding: '8px 14px' }} />
        </Row>
        <Row label="Timezone">
          <select className="clay-input text-[14px] cursor-pointer" defaultValue="Asia/Kolkata" style={{ borderRadius: 12, padding: '8px 14px' }}>
            {['UTC', 'Asia/Kolkata', 'America/New_York', 'America/Los_Angeles', 'Europe/London'].map(tz => <option key={tz}>{tz}</option>)}
          </select>
        </Row>
        <div className="px-7 py-5 flex justify-end">
          <button className="clay-btn clay-btn-sm text-[13px]">Save Changes</button>
        </div>
      </Card>
    </div>
  );
}

// ─── Integrations Section ────────────────────────────────────────────────────

function IntegrationsSection({ settings }: { settings: SettingsResponse }) {
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const triggerSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const result = await syncApi.triggerDirect();
      if (result.status === 'completed') {
        setSyncResult({ ok: true, msg: `Synced ${result.contactsFound ?? 0} contacts & ${result.threadsStored ?? 0} threads` });
      } else {
        setSyncResult({ ok: false, msg: result.error || 'Sync failed' });
      }
    } catch (e) {
      setSyncResult({ ok: false, msg: e instanceof Error ? e.message : 'Sync failed' });
    } finally {
      setSyncing(false);
    }
  };

  const integrations = [
    {
      name: 'Gmail', connected: settings.integrations.gmail.connected,
      color: '#EA4335', gradient: 'linear-gradient(135deg, #EA4335, #FF6D4A)',
      desc: settings.integrations.gmail.connected ? `${settings.integrations.gmail.email}` : 'Sync emails & contacts automatically',
      icon: Mail, features: ['Auto-log emails', 'Contact sync', 'AI draft sending'],
      canSync: settings.integrations.gmail.connected,
    },
    {
      name: 'Google Calendar', connected: settings.integrations.calendar.connected,
      color: '#1A73E8', gradient: 'linear-gradient(135deg, #1A73E8, #4FC3F7)',
      desc: settings.integrations.calendar.connected ? 'Syncing meetings' : 'Import meetings & set reminders',
      icon: Clock, features: ['Meeting import', 'Follow-up reminders', 'Availability sync'],
      canSync: false,
    },
    {
      name: 'LinkedIn', connected: settings.integrations.linkedin.connected,
      color: '#0A66C2', gradient: 'linear-gradient(135deg, #0A66C2, #0DB1DE)',
      desc: 'Track profile views and InMail',
      icon: Globe, features: ['Profile views', 'InMail tracking', 'Connection updates'],
      canSync: false,
    },
  ];

  return (
    <div className="space-y-4">
      {syncResult && (
        <div className="flex items-center gap-3 rounded-2xl px-5 py-4"
          style={{ background: syncResult.ok ? 'var(--success-bg)' : 'var(--danger-bg)', border: `1px solid ${syncResult.ok ? 'rgba(34,197,94,0.2)' : 'rgba(196,61,46,0.2)'}` }}>
          {syncResult.ok
            ? <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: 'var(--success)' }} />
            : <AlertTriangle className="h-4 w-4 shrink-0" style={{ color: 'var(--danger)' }} />}
          <p className="text-[13px] font-semibold" style={{ color: syncResult.ok ? 'var(--success)' : 'var(--danger)' }}>{syncResult.msg}</p>
          <button onClick={() => setSyncResult(null)} className="ml-auto text-[11px]" style={{ color: 'var(--text-muted)' }}>Dismiss</button>
        </div>
      )}

      {integrations.map(int => (
        <div key={int.name} data-testid={`integration-${int.name.toLowerCase().replace(/\s+/g, '-')}`}
          className="clay-card p-6 transition-all duration-200" style={{ borderRadius: 24 }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-clay-hover)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-clay)'; }}>
          <div className="flex items-start gap-5">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-white"
              style={{ background: int.gradient, boxShadow: `0 6px 20px color-mix(in srgb, ${int.color} 30%, transparent)` }}>
              <int.icon className="h-6 w-6" strokeWidth={1.5} />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-[16px] font-bold" style={{ color: 'var(--text)', fontFamily: 'var(--font-heading)' }}>{int.name}</h3>
                <div className="flex items-center gap-2">
                  {int.connected ? (
                    <>
                      {int.canSync && (
                        <button
                          id="gmail-sync-btn"
                          onClick={triggerSync}
                          disabled={syncing}
                          className="flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-bold transition-all"
                          style={{ background: 'var(--hot-bg)', color: 'var(--primary)', opacity: syncing ? 0.7 : 1, cursor: syncing ? 'wait' : 'pointer' }}>
                          <RefreshCw className={`h-3 w-3 ${syncing ? 'animate-spin' : ''}`} />
                          {syncing ? 'Syncing...' : 'Sync Now'}
                        </button>
                      )}
                      <span className="flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-bold" style={{ background: 'var(--success-bg)', color: 'var(--success)' }}>
                        <CheckCircle2 className="h-3.5 w-3.5" /> Connected
                      </span>
                    </>
                  ) : (
                    <button className="clay-btn clay-btn-sm text-[12px] flex items-center gap-1.5">
                      Connect <ExternalLink className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
              <p className="text-[13px] mb-3" style={{ color: 'var(--text-muted)' }}>{int.desc}</p>
              <div className="flex gap-2 flex-wrap">
                {int.features.map(f => (
                  <span key={f} className="text-[11px] font-medium px-2.5 py-1 rounded-lg" style={{ background: 'var(--bg)', color: 'var(--text-muted)' }}>{f}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}


// ─── Notifications Section ───────────────────────────────────────────────────

function NotificationsSection({ settings }: { settings: SettingsResponse }) {
  const n = settings.preferences.notifications;
  return (
    <div className="space-y-6">
      <Card title="Morning Digest" desc="Daily briefing sent to your inbox" icon={Mail}>
        <Row label="Enable morning digest" desc="Get a summary of your top priorities each morning"><Toggle on={n.digestEnabled} onChange={() => {}} label="digest" /></Row>
        <Row label="Delivery time">
          <select className="clay-input text-[14px] cursor-pointer" defaultValue={n.digestTime} style={{ borderRadius: 12, padding: '8px 14px' }}>
            {['07:00 AM', '07:30 AM', '08:00 AM', '08:30 AM', '09:00 AM'].map(t => <option key={t}>{t}</option>)}
          </select>
        </Row>
        <Row label="Timezone">
          <select className="clay-input text-[14px] cursor-pointer" defaultValue={n.timezone} style={{ borderRadius: 12, padding: '8px 14px' }}>
            {['UTC', 'Asia/Kolkata', 'America/New_York', 'America/Los_Angeles', 'Europe/London'].map(tz => <option key={tz}>{tz}</option>)}
          </select>
        </Row>
      </Card>

      <Card title="Real-time Alerts" icon={Bell}>
        <Row label="Hot relationship alerts" desc="Instant notification when a contact turns hot"><Toggle on={n.hotAlerts} onChange={() => {}} label="hot-alerts" /></Row>
        <Row label="Weekly pipeline report" desc="Pipeline movement summary every Monday"><Toggle on={n.weeklyReport} onChange={() => {}} label="weekly-report" /></Row>
        <Row label="Ghost warnings" desc="Alert when warm contacts go silent for 7+ days"><Toggle on={true} onChange={() => {}} label="ghost-warnings" /></Row>
      </Card>
    </div>
  );
}

// ─── AI Section ──────────────────────────────────────────────────────────────

function AISection({ settings }: { settings: SettingsResponse }) {
  const ai = settings.preferences.ai;
  const tones = ['Warm & Professional', 'Direct & Concise', 'Formal', 'Conversational'];
  const [selectedTone, setSelectedTone] = useState(ai.tone);

  const tonePreview: Record<string, string> = {
    'Warm & Professional': 'Hi Sarah, I hope this finds you well. I wanted to follow up on our conversation about...',
    'Direct & Concise': 'Sarah — quick follow up. Here are the metrics we discussed. Let me know your thoughts.',
    'Formal': 'Dear Ms. Chen, Thank you for your time during our previous meeting. I would like to provide...',
    'Conversational': 'Hey Sarah! Great chat the other day. Wanted to loop back with those numbers you asked about...',
  };

  return (
    <div className="space-y-6">
      <Card title="Draft Settings" desc="Control how AI writes your follow-ups" icon={Sparkles}>
        <Row label="Auto-generate drafts" desc="Automatically create drafts for contacts due a follow-up"><Toggle on={ai.autoGenerate} onChange={() => {}} label="auto-generate" /></Row>
        <Row label="Include email signature" desc="Append your Gmail signature to all drafts"><Toggle on={ai.includeSignature} onChange={() => {}} label="signature" /></Row>
        <Row label="Email length">
          <select className="clay-input text-[14px] cursor-pointer" defaultValue={ai.length} style={{ borderRadius: 12, padding: '8px 14px' }}>
            {['Concise (< 100 words)', 'Medium (100-200 words)', 'Detailed (200+ words)'].map(l => <option key={l}>{l}</option>)}
          </select>
        </Row>
      </Card>

      {/* Tone Picker with Preview */}
      <div className="clay-card p-7" style={{ borderRadius: 24 }}>
        <div className="flex items-center gap-3 mb-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: 'var(--warm-bg)' }}>
            <Palette className="h-4 w-4" style={{ color: 'var(--accent)' }} />
          </div>
          <div>
            <h3 className="text-[16px] font-bold" style={{ color: 'var(--text)', fontFamily: 'var(--font-heading)' }}>Writing Tone</h3>
            <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>Choose how your AI drafts sound</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-5">
          {tones.map(tone => (
            <button key={tone} data-testid={`tone-${tone.toLowerCase().replace(/\s+/g, '-')}`}
              onClick={() => setSelectedTone(tone)}
              className="rounded-2xl p-4 text-left transition-all duration-200"
              style={{
                backgroundColor: selectedTone === tone ? 'var(--hot-bg)' : 'var(--bg)',
                border: selectedTone === tone ? '2px solid var(--primary)' : '2px solid transparent',
                boxShadow: selectedTone === tone ? 'var(--shadow-clay-sm)' : 'none',
              }}>
              <p className="text-[14px] font-bold mb-0.5" style={{ color: selectedTone === tone ? 'var(--primary)' : 'var(--text)' }}>{tone}</p>
              <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                {tone === 'Warm & Professional' ? 'Friendly yet polished' : tone === 'Direct & Concise' ? 'No fluff, straight to point' : tone === 'Formal' ? 'Traditional business style' : 'Casual & approachable'}
              </p>
            </button>
          ))}
        </div>

        {/* Preview */}
        <div className="rounded-2xl p-5" style={{ backgroundColor: 'var(--bg)', boxShadow: 'var(--shadow-inset)' }}>
          <div className="flex items-center gap-2 mb-3">
            <MessageSquare className="h-3.5 w-3.5" style={{ color: 'var(--text-muted)' }} />
            <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-heading)' }}>Preview</span>
          </div>
          <p className="text-[14px] leading-relaxed italic" style={{ color: 'var(--text-muted)' }}>
            "{tonePreview[selectedTone] || tonePreview['Warm & Professional']}"
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Security Section ────────────────────────────────────────────────────────

function SecuritySection() {
  const { user } = useAuth();
  const browser = typeof navigator !== 'undefined'
    ? (navigator.userAgent.includes('Mac') ? 'macOS' : navigator.userAgent.includes('Windows') ? 'Windows' : 'Linux')
      + ' · ' + (navigator.userAgent.includes('Chrome') ? 'Chrome' : navigator.userAgent.includes('Safari') ? 'Safari' : 'Browser')
    : 'Unknown';

  return (
    <div className="space-y-6">
      <Card title="Password" desc="Update your login credentials" icon={Key}>
        <Row label="Current password"><input className="clay-input text-[14px] w-56" type="password" placeholder="Enter current" style={{ borderRadius: 12, padding: '8px 14px' }} /></Row>
        <Row label="New password"><input className="clay-input text-[14px] w-56" type="password" placeholder="Min 8 characters" style={{ borderRadius: 12, padding: '8px 14px' }} /></Row>
        <div className="px-7 py-5 flex justify-end"><button className="clay-btn clay-btn-sm text-[13px]">Update Password</button></div>
      </Card>

      <Card title="Active Sessions" icon={Monitor}>
        <div className="px-7 py-5">
          <div className="flex items-center justify-between rounded-2xl p-4" style={{ backgroundColor: 'var(--success-bg)' }}>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: 'var(--surface)' }}>
                <Monitor className="h-5 w-5" style={{ color: 'var(--success)' }} />
              </div>
              <div>
                <p className="text-[14px] font-semibold" style={{ color: 'var(--text)' }}>{browser}</p>
                <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>Signed in as {user?.email}</p>
              </div>
            </div>
            <span className="text-[12px] font-bold px-3 py-1 rounded-full" style={{ background: 'var(--surface)', color: 'var(--success)' }}>Current</span>
          </div>
        </div>
      </Card>

      {/* Danger zone */}
      <div className="rounded-3xl p-6 flex items-start gap-5" style={{ backgroundColor: 'var(--danger-bg)', border: '1px solid rgba(196,61,46,0.12)' }}>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: 'rgba(196,61,46,0.1)' }}>
          <Trash2 className="h-5 w-5" style={{ color: 'var(--danger)' }} />
        </div>
        <div>
          <p className="text-[16px] font-bold mb-1" style={{ color: 'var(--text)', fontFamily: 'var(--font-heading)' }}>Delete Account</p>
          <p className="text-[13px] mb-4" style={{ color: 'var(--text-muted)' }}>Permanently delete your contacts, pipeline, drafts and all account data. This cannot be undone.</p>
          <button className="rounded-xl px-5 py-2.5 text-[13px] font-bold transition-all"
            style={{ background: 'rgba(196,61,46,0.08)', color: 'var(--danger)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(196,61,46,0.15)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(196,61,46,0.08)'; }}>
            Delete My Account
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SETTINGS PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export default function SettingsPage() {
  const router = useRouter();
  const { subscription, creditBalance } = useSubscription();
  const [active, setActive] = useState<Section>('account');
  const [settings, setSettings] = useState<SettingsResponse | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      settingsApi.get().then(setSettings),
      billingApi.getPlans().then(res => setPlans(res.plans)).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  if (loading || !settings) return <div className="flex h-full items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--primary)' }} /></div>;

  const panels: Record<Section, React.ReactNode> = {
    account: <AccountSection settings={settings} />,
    integrations: <IntegrationsSection settings={settings} />,
    notifications: <NotificationsSection settings={settings} />,
    ai: <AISection settings={settings} />,
    security: <SecuritySection />,
  };

  return (
    <div data-testid="settings-page" className="flex h-full px-4 py-2 gap-5">
      {/* Nav */}
      <div className="clay-card w-[260px] shrink-0 flex flex-col" style={{ borderRadius: 24 }}>
        <div className="px-5 pt-6 pb-2">
          <h2 className="text-[20px] font-bold" style={{ color: 'var(--text)', fontFamily: 'var(--font-heading)' }}>Settings</h2>
        </div>
        <nav className="flex-1 px-3 py-2 space-y-1">
          {SECTIONS.map(({ id, label, desc, icon: Icon }) => (
            <button key={id} data-testid={`settings-nav-${id}`} onClick={() => setActive(id)}
              className="relative flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition-all duration-200"
              style={{
                backgroundColor: active === id ? 'var(--hot-bg)' : 'transparent',
                color: active === id ? 'var(--primary)' : 'var(--text-muted)',
              }}
              onMouseEnter={e => { if (active !== id) (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg)'; }}
              onMouseLeave={e => { if (active !== id) (e.currentTarget as HTMLElement).style.backgroundColor = active === id ? 'var(--hot-bg)' : 'transparent'; }}>
              <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.5} />
              <div className="min-w-0">
                <p className="text-[14px] font-semibold">{label}</p>
                <p className="text-[11px]" style={{ color: active === id ? 'color-mix(in srgb, var(--primary) 60%, var(--text-muted))' : 'var(--text-muted)' }}>{desc}</p>
              </div>
              <ChevronRight className="ml-auto h-3.5 w-3.5 shrink-0" style={{ opacity: active === id ? 1 : 0.3 }} />
            </button>
          ))}
        </nav>

        {/* Plan card */}
        <div className="px-4 pb-4">
          <div className="rounded-2xl p-5 relative overflow-hidden" style={{ background: 'linear-gradient(135deg, var(--primary), var(--accent))' }}>
            <div className="absolute top-2 right-2">
              <Crown className="h-5 w-5 text-white/20" />
            </div>
            <p className="text-[11px] font-bold text-white/80 uppercase tracking-wider mb-1" style={{ fontFamily: 'var(--font-heading)' }}>
              {subscription?.plan?.displayName || 'Starter'} Plan
            </p>
            <p className="text-[20px] font-extrabold text-white mb-1" style={{ fontFamily: 'var(--font-heading)' }}>
              ${(() => {
                const activePlan = plans.find(p => p.name === subscription?.plan?.name);
                return activePlan ? activePlan.priceMonthly : (subscription?.plan?.name === 'starter' ? 0 : 0);
              })()}
              <span className="text-[12px] font-normal text-white/60">/mo</span>
            </p>
            <p className="text-[11px] text-white/60 mb-3">
              {creditBalance?.balance || 0}/{subscription?.plan?.creditsPerMonth || 10} credits
            </p>
            <button 
              onClick={() => router.push('/plans')}
              className="w-full rounded-xl py-2 text-[12px] font-bold text-white transition-all"
              style={{ backgroundColor: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(4px)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255,255,255,0.25)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255,255,255,0.15)'; }}>
              {subscription?.plan?.name === 'enterprise' ? 'Manage Plan' : 'Upgrade Plan'}
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto pb-4">
        <div className="max-w-2xl">
          {panels[active]}
        </div>
      </div>
    </div>
  );
}
