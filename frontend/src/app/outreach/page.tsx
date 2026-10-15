'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  sequencesApi, contactsApi,
  type SequenceRecord, type SequenceDetail, type SequenceEnrollment,
  type SequenceEmail, type SequenceAnalytics, type SequenceStep,
  type ContactResponse,
} from '@/lib/api';
import {
  Send, Plus, Play, Pause, CheckCircle2, X, Loader2,
  ChevronRight, ChevronLeft, Mail, Eye, MessageSquare,
  Users, BarChart3, Clock, Sparkles, ArrowLeft, Edit3,
  Check, SkipForward, Search, Zap, AlertCircle,
} from 'lucide-react';

// ─── Status Colors ────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  draft:     { bg: '#EBE7E0', text: '#70655B', label: 'Draft' },
  active:    { bg: '#E3F5EC', text: '#2D8C5A', label: 'Active' },
  paused:    { bg: '#FDF3DF', text: '#A86B14', label: 'Paused' },
  completed: { bg: '#E8F0F3', text: '#2C5B6B', label: 'Completed' },
  approved:  { bg: '#EDE9FE', text: '#7C3AED', label: 'Approved' },
  replied:   { bg: '#DBEAFE', text: '#2563EB', label: 'Replied' },
  skipped:   { bg: '#EEECEA', text: '#8A8078', label: 'Skipped' },
  sent:      { bg: '#E3F5EC', text: '#2D8C5A', label: 'Sent' },
  opened:    { bg: '#FDF3DF', text: '#A86B14', label: 'Opened' },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.draft;
  return (
    <span
      style={{
        padding: '3px 10px', borderRadius: 10, fontSize: 11, fontWeight: 700,
        background: s.bg, color: s.text,
        fontFamily: "'Manrope', system-ui, sans-serif",
      }}
    >
      {s.label}
    </span>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function OutreachPage() {
  const [view, setView] = useState<'list' | 'detail' | 'analytics'>('list');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEnrollModal, setShowEnrollModal] = useState(false);

  const openDetail = (id: string) => { setSelectedId(id); setView('detail'); };
  const openAnalytics = (id: string) => { setSelectedId(id); setView('analytics'); };
  const backToList = () => { setSelectedId(null); setView('list'); };

  return (
    <div className="overflow-y-auto h-full" style={{ padding: 'var(--space-6) var(--space-8)' }}>
      {view === 'list' && (
        <SequenceListView
          onOpenDetail={openDetail}
          onOpenAnalytics={openAnalytics}
          onCreateNew={() => setShowCreateModal(true)}
        />
      )}

      {view === 'detail' && selectedId && (
        <SequenceDetailView
          sequenceId={selectedId}
          onBack={backToList}
          onOpenEnroll={() => setShowEnrollModal(true)}
          onOpenAnalytics={() => openAnalytics(selectedId)}
        />
      )}

      {view === 'analytics' && selectedId && (
        <SequenceAnalyticsView
          sequenceId={selectedId}
          onBack={() => { setView('detail'); }}
        />
      )}

      {showCreateModal && (
        <CreateSequenceModal
          onClose={() => setShowCreateModal(false)}
          onCreated={(id) => { setShowCreateModal(false); openDetail(id); }}
        />
      )}

      {showEnrollModal && selectedId && (
        <EnrollContactsModal
          sequenceId={selectedId}
          onClose={() => setShowEnrollModal(false)}
        />
      )}
    </div>
  );
}

// ─── Sequence List View ───────────────────────────────────────────────────────

function SequenceListView({ onOpenDetail, onOpenAnalytics, onCreateNew }: {
  onOpenDetail: (id: string) => void;
  onOpenAnalytics: (id: string) => void;
  onCreateNew: () => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['sequences'],
    queryFn: () => sequencesApi.list(),
  });

  const sequences = data?.data || [];

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1
            style={{
              fontSize: 28, fontWeight: 800,
              fontFamily: "'Manrope', system-ui, sans-serif",
              letterSpacing: '-0.02em', color: 'var(--text)',
            }}
          >
            <Send size={24} style={{ display: 'inline', marginRight: 10, verticalAlign: 'text-bottom', color: 'var(--primary)' }} />
            Outreach Sequences
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 4 }}>
            AI-powered email sequences with personalized investor outreach
          </p>
        </div>
        <button className="clay-btn" onClick={onCreateNew} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <Plus size={15} />
          New Sequence
        </button>
      </div>

      {/* Stats summary */}
      {sequences.length > 0 && (
        <div className="grid gap-4 mb-6" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          <StatCard label="Total" value={sequences.length} icon={<Mail size={16} />} color="var(--primary)" />
          <StatCard label="Active" value={sequences.filter(s => s.status === 'active').length} icon={<Play size={16} />} color="#2D8C5A" />
          <StatCard label="Draft" value={sequences.filter(s => s.status === 'draft').length} icon={<Edit3 size={16} />} color="#A86B14" />
          <StatCard label="Completed" value={sequences.filter(s => s.status === 'completed').length} icon={<CheckCircle2 size={16} />} color="#2C5B6B" />
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 120, borderRadius: 20 }} />
          ))}
        </div>
      ) : sequences.length === 0 ? (
        <EmptySequences onCreate={onCreateNew} />
      ) : (
        <div className="space-y-3">
          {sequences.map((seq, idx) => (
            <SequenceCard
              key={seq.id}
              sequence={seq}
              delay={idx}
              onOpenDetail={() => onOpenDetail(seq.id)}
              onOpenAnalytics={() => onOpenAnalytics(seq.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: string }) {
  return (
    <div className="clay-card-sm animate-fade-in" style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={{
        width: 40, height: 40, borderRadius: 14,
        background: `${color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center',
        color,
      }}>
        {icon}
      </div>
      <div>
        <p className="tabular-nums" style={{ fontSize: 22, fontWeight: 800, color, fontFamily: "'Manrope', system-ui, sans-serif", lineHeight: 1 }}>
          {value}
        </p>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginTop: 2 }}>{label}</p>
      </div>
    </div>
  );
}

function SequenceCard({ sequence, delay, onOpenDetail, onOpenAnalytics }: {
  sequence: SequenceRecord; delay: number;
  onOpenDetail: () => void; onOpenAnalytics: () => void;
}) {
  const queryClient = useQueryClient();
  const statusMut = useMutation({
    mutationFn: (status: string) => sequencesApi.updateStatus(sequence.id, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sequences'] }),
  });

  const stats = sequence.stats;
  const totalEnrolled = stats?.total || 0;

  return (
    <div
      className="clay-card clay-card-hover animate-fade-in"
      style={{
        padding: '20px 24px', cursor: 'pointer',
        animationDelay: `${Math.min(delay * 0.05, 0.3)}s`,
        opacity: 0, animationFillMode: 'forwards',
      }}
      onClick={onOpenDetail}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 min-w-0">
          <div style={{
            width: 44, height: 44, borderRadius: 14,
            background: 'linear-gradient(135deg, var(--primary), var(--accent))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Send size={18} color="#fff" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <h3 style={{ fontSize: 16, fontWeight: 700, fontFamily: "'Manrope', system-ui, sans-serif", color: 'var(--text)' }}>
                {sequence.name}
              </h3>
              <StatusBadge status={sequence.status} />
            </div>
            <div className="flex items-center gap-4 mt-1" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              <span className="flex items-center gap-1"><Users size={12} /> {totalEnrolled} enrolled</span>
              <span className="flex items-center gap-1"><Clock size={12} /> {(sequence.steps as any[])?.length || 0} steps</span>
              {stats && stats.replied > 0 && (
                <span className="flex items-center gap-1" style={{ color: '#2563EB' }}>
                  <MessageSquare size={12} /> {stats.replied} replied
                </span>
              )}
              {stats && stats.active > 0 && (
                <span className="flex items-center gap-1" style={{ color: '#2D8C5A' }}>
                  <Zap size={12} /> {stats.active} sending
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
          {sequence.status === 'draft' && stats && stats.approved > 0 && (
            <button
              className="clay-btn clay-btn-sm"
              onClick={() => statusMut.mutate('active')}
              style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
            >
              <Play size={12} /> Activate
            </button>
          )}
          {sequence.status === 'active' && (
            <button
              className="clay-btn-ghost clay-btn-sm"
              onClick={() => statusMut.mutate('paused')}
              style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
            >
              <Pause size={12} /> Pause
            </button>
          )}
          {sequence.status === 'paused' && (
            <button
              className="clay-btn clay-btn-sm"
              onClick={() => statusMut.mutate('active')}
              style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
            >
              <Play size={12} /> Resume
            </button>
          )}
          <button
            className="clay-btn-ghost clay-btn-sm"
            onClick={onOpenAnalytics}
            style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
          >
            <BarChart3 size={12} /> Stats
          </button>
        </div>
      </div>

      {/* Step timeline preview */}
      {(sequence.steps as any[])?.length > 0 && (
        <div className="flex items-center gap-2 mt-3" style={{ paddingLeft: 58 }}>
          {(sequence.steps as any[]).map((step: any, i: number) => (
            <div key={i} className="flex items-center gap-2">
              <div style={{
                padding: '3px 10px', borderRadius: 8, fontSize: 10, fontWeight: 600,
                background: 'var(--bg)', color: 'var(--text-muted)',
                fontFamily: "'Manrope', system-ui, sans-serif",
              }}>
                Day {step.dayOffset} · {step.emailType}
              </div>
              {i < (sequence.steps as any[]).length - 1 && (
                <ChevronRight size={10} style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Sequence Detail View ─────────────────────────────────────────────────────

function SequenceDetailView({ sequenceId, onBack, onOpenEnroll, onOpenAnalytics }: {
  sequenceId: string; onBack: () => void;
  onOpenEnroll: () => void; onOpenAnalytics: () => void;
}) {
  const queryClient = useQueryClient();

  const { data: sequence, isLoading } = useQuery({
    queryKey: ['sequence', sequenceId],
    queryFn: () => sequencesApi.get(sequenceId),
  });

  const statusMut = useMutation({
    mutationFn: (status: string) => sequencesApi.updateStatus(sequenceId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sequence', sequenceId] });
      queryClient.invalidateQueries({ queryKey: ['sequences'] });
    },
  });

  const batchApproveMut = useMutation({
    mutationFn: () => sequencesApi.batchApprove(sequenceId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sequence', sequenceId] }),
  });

  if (isLoading || !sequence) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 size={24} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
      </div>
    );
  }

  const enrollments = sequence.enrollments || [];
  const draftCount = enrollments.filter(e => e.status === 'draft').length;
  const hasApprovable = draftCount > 0;

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={onBack}
          className="clay-btn-ghost"
          style={{ padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
        >
          <ArrowLeft size={14} /> Back
        </button>
      </div>

      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 style={{
              fontSize: 24, fontWeight: 800,
              fontFamily: "'Manrope', system-ui, sans-serif",
              letterSpacing: '-0.02em', color: 'var(--text)',
            }}>
              {sequence.name}
            </h1>
            <StatusBadge status={sequence.status} />
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
            {enrollments.length} contacts enrolled · {(sequence.steps as any[])?.length || 0} steps
          </p>
        </div>

        <div className="flex items-center gap-2">
          {hasApprovable && (
            <button
              className="clay-btn clay-btn-sm"
              onClick={() => batchApproveMut.mutate()}
              disabled={batchApproveMut.isPending}
              style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
            >
              {batchApproveMut.isPending ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
              Approve All ({draftCount})
            </button>
          )}
          <button
            className="clay-btn-ghost clay-btn-sm"
            onClick={onOpenEnroll}
            style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
          >
            <Plus size={13} /> Enroll
          </button>
          {sequence.status === 'draft' && enrollments.some(e => e.status === 'approved') && (
            <button
              className="clay-btn clay-btn-sm"
              onClick={() => statusMut.mutate('active')}
              style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
            >
              <Play size={13} /> Activate
            </button>
          )}
          {sequence.status === 'active' && (
            <button
              className="clay-btn-ghost clay-btn-sm"
              onClick={() => statusMut.mutate('paused')}
              style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
            >
              <Pause size={13} /> Pause
            </button>
          )}
          <button
            className="clay-btn-ghost clay-btn-sm"
            onClick={onOpenAnalytics}
            style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
          >
            <BarChart3 size={13} /> Analytics
          </button>
        </div>
      </div>

      {/* Step timeline */}
      <StepTimeline steps={(sequence.steps as SequenceStep[]) || []} />

      {/* Enrollments */}
      {enrollments.length === 0 ? (
        <div className="clay-card animate-fade-in" style={{ textAlign: 'center', padding: '48px 32px', marginTop: 24 }}>
          <Users size={32} style={{ color: 'var(--text-muted)', margin: '0 auto 12px' }} />
          <h3 style={{ fontSize: 16, fontWeight: 700, fontFamily: "'Manrope', system-ui, sans-serif", marginBottom: 6 }}>
            No contacts enrolled yet
          </h3>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
            Enroll contacts to generate AI-personalized outreach emails
          </p>
          <button className="clay-btn clay-btn-sm" onClick={onOpenEnroll} style={{ cursor: 'pointer' }}>
            <Plus size={13} style={{ marginRight: 6 }} /> Enroll Contacts
          </button>
        </div>
      ) : (
        <div className="space-y-3 mt-4">
          {enrollments.map((enrollment, idx) => (
            <EnrollmentCard
              key={enrollment.id}
              enrollment={enrollment}
              sequenceId={sequenceId}
              delay={idx}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function StepTimeline({ steps }: { steps: SequenceStep[] }) {
  if (!steps || steps.length === 0) return null;

  return (
    <div className="clay-card-sm flex items-center gap-0 mb-4 animate-fade-in" style={{ padding: '14px 20px', overflowX: 'auto' }}>
      {steps.map((step, i) => (
        <div key={i} className="flex items-center gap-0" style={{ flexShrink: 0 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: 36, height: 36, borderRadius: 12,
              background: i === 0 ? 'var(--primary)' : 'var(--bg)',
              color: i === 0 ? '#fff' : 'var(--text-muted)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 800, fontSize: 13, fontFamily: "'Manrope', system-ui, sans-serif",
              margin: '0 auto 4px',
            }}>
              {step.step}
            </div>
            <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)' }}>
              Day {step.dayOffset}
            </p>
            <p style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'capitalize' }}>
              {step.emailType}
            </p>
          </div>
          {i < steps.length - 1 && (
            <div style={{
              width: 48, height: 2, background: 'var(--border)',
              margin: '0 8px', marginBottom: 18,
            }} />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Enrollment Card with Email Preview ───────────────────────────────────────

function EnrollmentCard({ enrollment, sequenceId, delay }: {
  enrollment: SequenceEnrollment; sequenceId: string; delay: number;
}) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [editSubject, setEditSubject] = useState('');
  const [editBody, setEditBody] = useState('');

  const approveMut = useMutation({
    mutationFn: ({ emailId, data }: { emailId: string; data?: { subject?: string; body?: string } }) =>
      sequencesApi.approveEmail(emailId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sequence', sequenceId] });
      setEditing(null);
    },
  });

  const skipMut = useMutation({
    mutationFn: () => sequencesApi.skipEnrollment(enrollment.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sequence', sequenceId] }),
  });

  const contact = enrollment.contact;
  const emails = enrollment.emails || [];

  const startEdit = (email: SequenceEmail) => {
    setEditing(email.id);
    setEditSubject(email.subject || '');
    setEditBody(email.body || '');
  };

  const contactInitials = contact?.name
    ? contact.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : contact?.email?.[0]?.toUpperCase() || '?';

  return (
    <div
      className="clay-card animate-fade-in"
      style={{
        animationDelay: `${Math.min(delay * 0.04, 0.3)}s`,
        opacity: 0, animationFillMode: 'forwards',
        overflow: 'hidden',
      }}
    >
      {/* Contact header */}
      <div
        className="flex items-center justify-between"
        style={{ padding: '16px 20px', cursor: 'pointer' }}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div style={{
            width: 38, height: 38, borderRadius: 12,
            background: 'linear-gradient(135deg, var(--primary), var(--accent))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 12, fontWeight: 700, flexShrink: 0,
            fontFamily: "'Manrope', system-ui, sans-serif",
          }}>
            {contactInitials}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', fontFamily: "'Manrope', system-ui, sans-serif" }}>
                {contact?.name || contact?.email || 'Unknown'}
              </p>
              <StatusBadge status={enrollment.status} />
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {contact?.company && `${contact.company} · `}
              {contact?.email} · Step {enrollment.currentStep}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
          {enrollment.status === 'draft' && (
            <button
              className="clay-btn-ghost clay-btn-sm"
              onClick={() => skipMut.mutate()}
              style={{ fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <SkipForward size={12} /> Skip
            </button>
          )}
          <ChevronRight
            size={16}
            style={{
              color: 'var(--text-muted)',
              transform: expanded ? 'rotate(90deg)' : 'none',
              transition: 'transform 0.2s ease',
            }}
          />
        </div>
      </div>

      {/* Expanded email previews */}
      {expanded && (
        <div style={{ borderTop: '1px solid var(--border)', background: 'var(--bg)', padding: '16px 20px' }}>
          {emails.length === 0 ? (
            <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: 16 }}>
              No emails generated yet
            </p>
          ) : (
            <div className="space-y-3">
              {emails.map(email => (
                <div key={email.id} className="clay-card-sm" style={{ padding: '14px 16px' }}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                        Step {email.stepNumber}
                      </span>
                      <StatusBadge status={email.status} />
                    </div>
                    {email.status === 'draft' && (
                      <div className="flex items-center gap-1">
                        {editing === email.id ? (
                          <>
                            <button
                              className="clay-btn clay-btn-sm"
                              onClick={() => approveMut.mutate({
                                emailId: email.id,
                                data: { subject: editSubject, body: editBody },
                              })}
                              disabled={approveMut.isPending}
                              style={{ fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px' }}
                            >
                              {approveMut.isPending ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                              Save & Approve
                            </button>
                            <button
                              className="clay-btn-ghost clay-btn-sm"
                              onClick={() => setEditing(null)}
                              style={{ fontSize: 11, cursor: 'pointer', padding: '4px 10px' }}
                            >
                              <X size={11} />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              className="clay-btn-ghost clay-btn-sm"
                              onClick={() => startEdit(email)}
                              style={{ fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px' }}
                            >
                              <Edit3 size={11} /> Edit
                            </button>
                            <button
                              className="clay-btn clay-btn-sm"
                              onClick={() => approveMut.mutate({ emailId: email.id })}
                              disabled={approveMut.isPending}
                              style={{ fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px' }}
                            >
                              <Check size={11} /> Approve
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {editing === email.id ? (
                    <div className="space-y-2">
                      <input
                        className="clay-input w-full"
                        value={editSubject}
                        onChange={e => setEditSubject(e.target.value)}
                        placeholder="Subject line..."
                        style={{ width: '100%', fontSize: 13, fontWeight: 600 }}
                      />
                      <textarea
                        className="clay-input w-full"
                        value={editBody}
                        onChange={e => setEditBody(e.target.value)}
                        rows={8}
                        style={{ width: '100%', fontSize: 13, resize: 'vertical', fontFamily: "'Work Sans', system-ui, sans-serif", lineHeight: 1.6 }}
                      />
                    </div>
                  ) : (
                    <>
                      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>
                        {email.subject || '(No subject)'}
                      </p>
                      <p style={{
                        fontSize: 12, lineHeight: 1.6, color: 'var(--text-muted)',
                        whiteSpace: 'pre-wrap',
                      }}>
                        {email.body || '(No body)'}
                      </p>
                    </>
                  )}

                  {/* Email metadata */}
                  {(email.sentAt || email.openedAt) && (
                    <div className="flex items-center gap-3 mt-3" style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                      {email.sentAt && (
                        <span className="flex items-center gap-1">
                          <Send size={10} /> Sent {new Date(email.sentAt).toLocaleDateString()}
                        </span>
                      )}
                      {email.openedAt && (
                        <span className="flex items-center gap-1" style={{ color: '#A86B14' }}>
                          <Eye size={10} /> Opened {new Date(email.openedAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Sequence Analytics View ──────────────────────────────────────────────────

function SequenceAnalyticsView({ sequenceId, onBack }: { sequenceId: string; onBack: () => void }) {
  const { data: analytics, isLoading } = useQuery({
    queryKey: ['sequence-analytics', sequenceId],
    queryFn: () => sequencesApi.analytics(sequenceId),
  });

  if (isLoading || !analytics) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 size={24} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
      </div>
    );
  }

  const funnelSteps = [
    { label: 'Enrolled', value: analytics.totalEnrolled, color: '#8B5CF6' },
    { label: 'Sent', value: analytics.emailStats.sent, color: 'var(--primary)' },
    { label: 'Opened', value: analytics.emailStats.opened, color: '#F59E0B' },
    { label: 'Replied', value: analytics.emailStats.replied, color: '#2D8C5A' },
  ];

  const maxFunnel = Math.max(...funnelSteps.map(s => s.value), 1);

  return (
    <div className="animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={onBack}
          className="clay-btn-ghost"
          style={{ padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
        >
          <ArrowLeft size={14} /> Back
        </button>
      </div>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 style={{
            fontSize: 24, fontWeight: 800,
            fontFamily: "'Manrope', system-ui, sans-serif",
            letterSpacing: '-0.02em', color: 'var(--text)',
          }}>
            <BarChart3 size={22} style={{ display: 'inline', marginRight: 10, verticalAlign: 'text-bottom', color: 'var(--primary)' }} />
            {analytics.sequenceName} — Analytics
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
            Performance metrics and funnel analysis
          </p>
        </div>
        <StatusBadge status={analytics.status} />
      </div>

      {/* Reply rate hero */}
      <div className="clay-card mb-6 animate-fade-in" style={{ padding: '32px', textAlign: 'center' }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Reply Rate
        </p>
        <p className="tabular-nums" style={{
          fontSize: 56, fontWeight: 800, lineHeight: 1,
          fontFamily: "'Manrope', system-ui, sans-serif",
          color: analytics.replyRate >= 20 ? '#2D8C5A' : analytics.replyRate >= 10 ? '#F59E0B' : 'var(--primary)',
        }}>
          {analytics.replyRate}%
        </p>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
          {analytics.emailStats.replied} replies out of {analytics.emailStats.sent} sent
        </p>
      </div>

      {/* Funnel */}
      <div className="clay-card mb-6 animate-fade-in stagger-1" style={{ padding: '24px' }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Outreach Funnel
        </h3>
        <div className="space-y-4">
          {funnelSteps.map((step) => (
            <div key={step.label} className="flex items-center gap-4">
              <span style={{ width: 70, fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textAlign: 'right' }}>
                {step.label}
              </span>
              <div style={{ flex: 1, height: 28, borderRadius: 10, background: 'var(--bg)', overflow: 'hidden' }}>
                <div style={{
                  width: `${Math.max((step.value / maxFunnel) * 100, 2)}%`,
                  height: '100%', borderRadius: 10,
                  background: step.color,
                  transition: 'width 0.8s cubic-bezier(0.22,1,0.36,1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 8,
                }}>
                  <span className="tabular-nums" style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>
                    {step.value}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Status breakdown */}
      <div className="grid gap-4 animate-fade-in stagger-2" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="clay-card-sm" style={{ padding: '16px', textAlign: 'center' }}>
          <Mail size={18} style={{ color: 'var(--primary)', margin: '0 auto 8px' }} />
          <p className="tabular-nums" style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)', fontFamily: "'Manrope', system-ui, sans-serif" }}>
            {analytics.emailStats.total}
          </p>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Total Emails</p>
        </div>
        <div className="clay-card-sm" style={{ padding: '16px', textAlign: 'center' }}>
          <Eye size={18} style={{ color: '#F59E0B', margin: '0 auto 8px' }} />
          <p className="tabular-nums" style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)', fontFamily: "'Manrope', system-ui, sans-serif" }}>
            {analytics.emailStats.sent > 0 ? Math.round((analytics.emailStats.opened / analytics.emailStats.sent) * 100) : 0}%
          </p>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Open Rate</p>
        </div>
        <div className="clay-card-sm" style={{ padding: '16px', textAlign: 'center' }}>
          <Users size={18} style={{ color: '#2C5B6B', margin: '0 auto 8px' }} />
          <p className="tabular-nums" style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)', fontFamily: "'Manrope', system-ui, sans-serif" }}>
            {analytics.totalEnrolled}
          </p>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Total Enrolled</p>
        </div>
      </div>
    </div>
  );
}

// ─── Create Sequence Modal ────────────────────────────────────────────────────

const DEFAULT_STEPS: SequenceStep[] = [
  { step: 1, dayOffset: 0, emailType: 'opening' },
  { step: 2, dayOffset: 6, emailType: 'followup' },
  { step: 3, dayOffset: 13, emailType: 'breakup' },
];

function CreateSequenceModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [steps, setSteps] = useState<SequenceStep[]>(DEFAULT_STEPS);

  const createMut = useMutation({
    mutationFn: () => sequencesApi.create({ name, steps }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['sequences'] });
      onCreated(data.id);
    },
  });

  const updateStep = (index: number, field: string, value: any) => {
    setSteps(prev => prev.map((s, i) => i === index ? { ...s, [field]: value } : s));
  };

  const addStep = () => {
    const lastStep = steps[steps.length - 1];
    setSteps(prev => [...prev, {
      step: prev.length + 1,
      dayOffset: (lastStep?.dayOffset || 0) + 7,
      emailType: 'followup',
    }]);
  };

  const removeStep = (index: number) => {
    if (steps.length <= 1) return;
    setSteps(prev => prev.filter((_, i) => i !== index).map((s, i) => ({ ...s, step: i + 1 })));
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        className="clay-card animate-modal-in"
        style={{ width: 520, maxHeight: '80vh', overflow: 'auto', padding: '28px' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 style={{ fontSize: 18, fontWeight: 800, fontFamily: "'Manrope', system-ui, sans-serif" }}>
            Create Outreach Sequence
          </h2>
          <button onClick={onClose} style={{ cursor: 'pointer', background: 'none', border: 'none', color: 'var(--text-muted)' }}>
            <X size={18} />
          </button>
        </div>

        {/* Name */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>
            Sequence Name <span style={{ color: 'var(--primary)' }}>*</span>
          </label>
          <input
            className="clay-input w-full"
            placeholder="e.g., Series A – Bay Area VCs"
            value={name}
            onChange={e => setName(e.target.value)}
            style={{ width: '100%' }}
          />
        </div>

        {/* Steps */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 10 }}>
            Sequence Steps
          </label>
          <div className="space-y-2">
            {steps.map((step, i) => (
              <div key={i} className="clay-card-sm flex items-center gap-3" style={{ padding: '10px 14px' }}>
                <span style={{
                  width: 24, height: 24, borderRadius: 8,
                  background: 'var(--primary)', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 800, flexShrink: 0,
                }}>
                  {step.step}
                </span>
                <div className="flex items-center gap-2 flex-1">
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Day</label>
                  <input
                    className="clay-input"
                    type="number"
                    value={step.dayOffset}
                    onChange={e => updateStep(i, 'dayOffset', parseInt(e.target.value) || 0)}
                    style={{ width: 60, padding: '6px 10px', fontSize: 12 }}
                  />
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Type</label>
                  <select
                    value={step.emailType}
                    onChange={e => updateStep(i, 'emailType', e.target.value)}
                    className="clay-input"
                    style={{ padding: '6px 10px', fontSize: 12, flex: 1 }}
                  >
                    <option value="opening">Opening</option>
                    <option value="followup">Follow-up</option>
                    <option value="breakup">Breakup</option>
                  </select>
                </div>
                {steps.length > 1 && (
                  <button
                    onClick={() => removeStep(i)}
                    style={{ cursor: 'pointer', background: 'none', border: 'none', color: 'var(--text-muted)' }}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            onClick={addStep}
            className="clay-btn-ghost clay-btn-sm"
            style={{ marginTop: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}
          >
            <Plus size={12} /> Add Step
          </button>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button className="clay-btn-ghost" onClick={onClose} style={{ cursor: 'pointer' }}>Cancel</button>
          <button
            className="clay-btn"
            onClick={() => createMut.mutate()}
            disabled={!name.trim() || createMut.isPending}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, cursor: name.trim() ? 'pointer' : 'not-allowed',
              opacity: name.trim() ? 1 : 0.5,
            }}
          >
            {createMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            Create Sequence
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Enroll Contacts Modal ────────────────────────────────────────────────────

function EnrollContactsModal({ sequenceId, onClose }: { sequenceId: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>([]);

  const { data: contactsData, isLoading } = useQuery({
    queryKey: ['contacts-for-enroll', search],
    queryFn: () => contactsApi.list({ search, limit: '50' }),
  });

  const enrollMut = useMutation({
    mutationFn: () => sequencesApi.enroll(sequenceId, selected),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sequence', sequenceId] });
      onClose();
    },
  });

  const contacts = contactsData?.data || [];

  const toggle = (id: string) => {
    setSelected(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id],
    );
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        className="clay-card animate-modal-in"
        style={{ width: 520, maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ padding: '24px 28px 0' }}>
          <div className="flex items-center justify-between mb-4">
            <h2 style={{ fontSize: 18, fontWeight: 800, fontFamily: "'Manrope', system-ui, sans-serif" }}>
              Enroll Contacts
            </h2>
            <button onClick={onClose} style={{ cursor: 'pointer', background: 'none', border: 'none', color: 'var(--text-muted)' }}>
              <X size={18} />
            </button>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
            Select contacts to enroll. AI will generate personalized emails for each.
          </p>

          <div className="relative mb-3">
            <Search size={14} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              className="clay-input w-full"
              placeholder="Search contacts..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: '100%', paddingLeft: 38, fontSize: 13 }}
            />
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0 28px' }}>
          {isLoading ? (
            <div className="space-y-2" style={{ padding: '8px 0' }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="skeleton" style={{ height: 48, borderRadius: 12 }} />
              ))}
            </div>
          ) : contacts.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: 32 }}>
              No contacts found
            </p>
          ) : (
            <div className="space-y-1" style={{ padding: '4px 0' }}>
              {contacts.map(contact => {
                const isSelected = selected.includes(contact.id);
                return (
                  <div
                    key={contact.id}
                    onClick={() => toggle(contact.id)}
                    className="flex items-center gap-3 rounded-xl transition-colors duration-150"
                    style={{
                      padding: '10px 12px', cursor: 'pointer',
                      background: isSelected ? 'rgba(211,92,62,0.08)' : 'transparent',
                    }}
                  >
                    <div style={{
                      width: 20, height: 20, borderRadius: 6, flexShrink: 0,
                      border: isSelected ? 'none' : '2px solid var(--border-strong)',
                      background: isSelected ? 'var(--primary)' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {isSelected && <Check size={12} color="#fff" strokeWidth={3} />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                        {contact.name || contact.email}
                      </p>
                      <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {contact.company && `${contact.company} · `}{contact.email}
                      </p>
                    </div>
                    {contact.pipelineStage !== 'none' && (
                      <span style={{
                        fontSize: 10, fontWeight: 600, padding: '2px 8px',
                        borderRadius: 6, background: 'var(--bg)', color: 'var(--text-muted)',
                      }}>
                        {contact.pipelineStage}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div style={{
          padding: '16px 28px', borderTop: '1px solid var(--border)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>
            {selected.length} contact{selected.length !== 1 ? 's' : ''} selected
          </span>
          <div className="flex gap-2">
            <button className="clay-btn-ghost" onClick={onClose} style={{ cursor: 'pointer' }}>Cancel</button>
            <button
              className="clay-btn"
              onClick={() => enrollMut.mutate()}
              disabled={selected.length === 0 || enrollMut.isPending}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                cursor: selected.length > 0 ? 'pointer' : 'not-allowed',
                opacity: selected.length > 0 ? 1 : 0.5,
              }}
            >
              {enrollMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              Enroll & Generate
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptySequences({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="clay-card animate-fade-in" style={{ textAlign: 'center', padding: '64px 48px', maxWidth: 520, margin: '48px auto' }}>
      <div style={{
        width: 72, height: 72, borderRadius: 22,
        background: 'linear-gradient(135deg, var(--primary), var(--accent))',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 24px',
      }}>
        <Send size={32} color="#fff" />
      </div>
      <h3 style={{ fontSize: 20, fontWeight: 800, fontFamily: "'Manrope', system-ui, sans-serif", marginBottom: 10 }}>
        Launch Your First Sequence
      </h3>
      <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 24, maxWidth: 360, margin: '0 auto 24px' }}>
        Create multi-step outreach sequences with AI-generated, personalized emails for each investor. Track opens, replies, and optimize your approach.
      </p>
      <button className="clay-btn" onClick={onCreate} style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <Plus size={15} /> Create Sequence
      </button>
    </div>
  );
}
