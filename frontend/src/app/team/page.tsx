'use client';

import { useEffect, useState } from 'react';
import { Users2, Plus, Shield, User, Eye, Trash2, CheckCircle, Crown, Send, Mail } from 'lucide-react';
import { workspaceApi } from '@/lib/api';

interface OrgMember {
  id: string;
  userId: string;
  role: string;
  joinedAt: string;
}

interface ActivityItem {
  id: string;
  userId?: string;
  contactId?: string | null;
  activityType: string;
  metadata: any;
  createdAt: string;
}

const ROLE_CONFIG = {
  owner: { label: 'Owner', icon: Crown, color: '#E09A36', bg: 'rgba(224,154,54,0.1)' },
  contributor: { label: 'Contributor', icon: User, color: 'var(--primary)', bg: 'rgba(211,92,62,0.08)' },
  viewer: { label: 'Viewer', icon: Eye, color: 'var(--text-muted)', bg: 'rgba(42,35,31,0.06)' },
};

const ACTIVITY_LABELS: Record<string, string> = {
  email_sent: 'Sent an email',
  stage_changed: 'Moved contact in pipeline',
  note_added: 'Added a note',
  brief_viewed: 'Viewed meeting brief',
};

function RoleBadge({ role }: { role: string }) {
  const config = ROLE_CONFIG[role as keyof typeof ROLE_CONFIG] ?? ROLE_CONFIG.viewer;
  const Icon = config.icon;
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
      style={{ background: config.bg, color: config.color }}
    >
      <Icon className="h-3 w-3" />
      {config.label}
    </span>
  );
}

export default function TeamPage() {
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'contributor' | 'viewer'>('contributor');
  const [inviting, setInviting] = useState(false);
  const [inviteResult, setInviteResult] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [membersData, activityData] = await Promise.all([
        workspaceApi.members(),
        workspaceApi.activity(),
      ]);
      setMembers(Array.isArray(membersData) ? membersData : []);
      setActivity(Array.isArray(activityData) ? activityData : []);
    } catch {
      setMembers([]);
      setActivity([]);
    } finally {
      setLoading(false);
    }
  };

  const invite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setInviteResult(null);
    try {
      const data = await workspaceApi.invite(inviteEmail, inviteRole);
      setInviteResult(data.status === 'added' ? `✓ ${inviteEmail} added to your workspace` : `Invite sent to ${inviteEmail}`);
      setInviteEmail('');
      await load();
    } catch {
      setInviteResult('Failed to invite. Try again.');
    } finally {
      setInviting(false);
    }
  };

  const removeMember = async (memberId: string) => {
    if (!confirm('Remove this team member?')) return;
    await workspaceApi.removeMember(memberId);
    setMembers(prev => prev.filter(m => m.id !== memberId));
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="flex-1 overflow-y-auto" style={{ background: 'var(--bg)' }}>
      <div className="max-w-3xl mx-auto p-8 space-y-6">

        <div className="animate-fade-in">
          <h1 className="text-2xl font-extrabold tracking-tight" style={{ fontFamily: 'var(--font-heading)', color: 'var(--text)' }}>
            Shared Workspace
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            Invite co-founders and advisors — share your pipeline with RBAC
          </p>
        </div>

        {/* RBAC explainer */}
        <div className="grid grid-cols-3 gap-3 animate-fade-in stagger-1">
          {Object.entries(ROLE_CONFIG).map(([role, config]) => {
            const Icon = config.icon;
            return (
              <div key={role} className="clay-card-sm p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="h-4 w-4" style={{ color: config.color }} />
                  <p className="text-sm font-bold" style={{ color: config.color }}>{config.label}</p>
                </div>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {role === 'owner' && 'Full access — can invite, send emails, change stages'}
                  {role === 'contributor' && 'Can view, send emails, add notes — cannot manage members'}
                  {role === 'viewer' && 'Read-only — cannot send emails or change pipeline'}
                </p>
              </div>
            );
          })}
        </div>

        {/* Invite */}
        <div className="clay-card p-6 space-y-4 animate-fade-in stagger-2">
          <p className="text-sm font-bold" style={{ fontFamily: 'var(--font-heading)', color: 'var(--text)' }}>Invite Team Member</p>
          <div className="flex gap-2">
            <input
              type="email"
              className="clay-input flex-1"
              placeholder="email@company.com"
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && invite()}
            />
            <select
              className="clay-input"
              value={inviteRole}
              onChange={e => setInviteRole(e.target.value as any)}
              style={{ minWidth: 140 }}
            >
              <option value="contributor">Contributor</option>
              <option value="viewer">Viewer</option>
            </select>
            <button
              className="clay-btn flex items-center gap-2"
              onClick={invite}
              disabled={inviting || !inviteEmail.trim()}
            >
              <Send className="h-4 w-4" />
              {inviting ? 'Inviting...' : 'Invite'}
            </button>
          </div>
          {inviteResult && (
            <p
              className="text-sm font-medium flex items-center gap-1.5 animate-fade-in"
              style={{ color: inviteResult.startsWith('✓') ? '#2D8C5A' : 'var(--danger)' }}
            >
              {inviteResult.startsWith('✓') && <CheckCircle className="h-4 w-4" />}
              {inviteResult}
            </p>
          )}
        </div>

        {/* Member list */}
        <div className="clay-card p-6 animate-fade-in stagger-3">
          <p className="text-sm font-bold mb-4" style={{ fontFamily: 'var(--font-heading)', color: 'var(--text)' }}>
            Team Members {members.length > 0 && `(${members.length})`}
          </p>
          {loading ? (
            <div className="space-y-3">
              {[...Array(2)].map((_, i) => <div key={i} className="h-12 skeleton rounded-xl" />)}
            </div>
          ) : members.length === 0 ? (
            <div className="text-center py-6">
              <Users2 className="h-9 w-9 mx-auto mb-2" style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Just you so far — invite your co-founder</p>
            </div>
          ) : (
            <div className="space-y-2">
              {members.map(member => (
                <div
                  key={member.id}
                  className="flex items-center justify-between py-2.5 px-3 rounded-2xl"
                  style={{ background: 'rgba(42,35,31,0.02)' }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
                      style={{ background: 'linear-gradient(135deg, var(--primary), var(--accent))' }}
                    >
                      {member.userId.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{member.userId}</p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        Joined {new Date(member.joinedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <RoleBadge role={member.role} />
                    {member.role !== 'owner' && (
                      <button
                        className="h-7 w-7 rounded-full flex items-center justify-center"
                        style={{ color: 'var(--text-muted)' }}
                        onClick={() => removeMember(member.id)}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(196,61,46,0.08)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Activity feed */}
        {activity.length > 0 && (
          <div className="clay-card p-6 animate-fade-in stagger-4">
            <p className="text-sm font-bold mb-4" style={{ fontFamily: 'var(--font-heading)', color: 'var(--text)' }}>
              Team Activity
            </p>
            <div className="space-y-3">
              {activity.slice(0, 15).map(item => (
                <div key={item.id} className="flex items-start gap-3">
                  <div
                    className="h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0 mt-0.5"
                    style={{ background: 'linear-gradient(135deg, var(--primary), var(--accent))' }}
                  >
                    {(item.userId ?? '??').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm" style={{ color: 'var(--text)' }}>
                      {ACTIVITY_LABELS[item.activityType] ?? item.activityType}
                      {item.metadata?.preview && (
                        <span className="ml-1 opacity-60">— "{item.metadata.preview}"</span>
                      )}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {new Date(item.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
