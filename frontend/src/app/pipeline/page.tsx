'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  DndContext, DragOverlay, closestCorners, PointerSensor, useSensor, useSensors,
  useDraggable, useDroppable, type DragStartEvent, type DragEndEvent,
} from '@dnd-kit/core';
import { Plus, GripVertical, Loader2, Sparkles, Clock } from 'lucide-react';
import { WarmthBadge } from '@/components/WarmthBadge';
import { AddContactModal } from '@/components/AddContactModal';
import type { WarmthTier } from '@/lib/types';
import { pipelineApi, type ContactResponse } from '@/lib/api';

const ACTIVE_STAGES = ['intro', 'meeting', 'dd', 'term_sheet'] as const;
const STAGE_CONFIG: Record<string, { label: string; color: string }> = {
  intro: { label: 'Intro', color: '#2C5B6B' },
  meeting: { label: 'Meeting', color: '#2D8C5A' },
  dd: { label: 'Due Diligence', color: '#E09A36' },
  term_sheet: { label: 'Term Sheet', color: '#D35C3E' },
  closed_won: { label: 'Won', color: '#2D8C5A' },
  closed_lost: { label: 'Lost', color: '#C43D2E' },
  paused: { label: 'Paused', color: '#8A8078' },
};

function timeAgo(d: string | null) {
  if (!d) return 'Never';
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return '1d ago';
  return `${days}d ago`;
}

function DraggableCard({ contact, onAction }: { contact: ContactResponse; onAction: (a: string, c: ContactResponse) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: contact.id });
  const stalled = contact.pipelineUpdatedAt && (Date.now() - new Date(contact.pipelineUpdatedAt).getTime()) / 86400000 >= 14;

  return (
    <article ref={setNodeRef} data-testid={`pipeline-card-${contact.id}`}
      className="clay-card-sm p-4 group cursor-default transition-all duration-200 relative"
      style={{ opacity: isDragging ? 0.4 : 1, borderColor: stalled ? 'rgba(224,154,54,0.3)' : undefined }}>
      <div className="absolute left-1.5 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-50 transition-opacity cursor-grab" {...listeners} {...attributes}>
        <GripVertical className="h-4 w-4" style={{ color: 'var(--text-muted)' }} />
      </div>
      <div className="pl-4">
        {stalled && (
          <div className="flex items-center gap-1 mb-2">
            <Clock className="h-3 w-3" style={{ color: 'var(--accent)' }} />
            <span className="text-[10px] font-bold" style={{ color: 'var(--accent)', fontFamily: 'var(--font-heading)' }}>Stalled</span>
          </div>
        )}
        <p className="text-[14px] font-semibold" style={{ color: 'var(--text)' }}>{contact.name || contact.email.split('@')[0]}</p>
        <p className="text-[12px] mt-0.5 mb-3" style={{ color: 'var(--text-muted)' }}>{contact.company || contact.email}</p>
        <div className="flex items-center justify-between">
          <WarmthBadge tier={contact.warmthTier as WarmthTier} />
          <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{timeAgo(contact.lastContactedAt)}</span>
        </div>
      </div>
    </article>
  );
}

function StageColumn({ stageId, contacts, onAction }: { stageId: string; contacts: ContactResponse[]; onAction: (a: string, c: ContactResponse) => void }) {
  const { isOver, setNodeRef } = useDroppable({ id: stageId });
  const cfg = STAGE_CONFIG[stageId] || { label: stageId, color: 'var(--primary)' };

  return (
    <div ref={setNodeRef} data-testid={`stage-column-${stageId}`}
      className="flex flex-col min-w-[280px] w-[280px] transition-all duration-200 rounded-3xl p-3"
      style={{ backgroundColor: isOver ? 'rgba(211,92,62,0.04)' : 'transparent' }}>
      <div className="mb-4 flex items-center gap-2.5 px-2">
        <span className="shrink-0 rounded-full" style={{ width: 10, height: 10, backgroundColor: cfg.color }} />
        <h2 className="text-[12px] font-bold tracking-[0.15em] uppercase" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-heading)' }}>{cfg.label}</h2>
        <span className="ml-1 flex h-6 min-w-[24px] items-center justify-center rounded-full px-2 text-[12px] font-bold tabular-nums"
          style={{ backgroundColor: 'var(--bg)', color: 'var(--text-muted)', fontFamily: 'var(--font-heading)' }}>{contacts.length}</span>
      </div>
      <div className="space-y-3 flex-1">
        {contacts.map(c => <DraggableCard key={c.id} contact={c} onAction={onAction} />)}
        {contacts.length === 0 && (
          <div className="flex h-24 items-center justify-center rounded-2xl border-2 border-dashed transition-colors"
            style={{ borderColor: isOver ? 'var(--primary)' : 'var(--border-strong)' }}>
            <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>{isOver ? 'Drop here' : 'No contacts'}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PipelinePage() {
  const [pipeline, setPipeline] = useState<Record<string, ContactResponse[]>>({});
  const [loading, setLoading] = useState(true);
  const [dragging, setDragging] = useState<ContactResponse | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const fetchPipeline = useCallback(() => {
    pipelineApi.get().then(d => setPipeline(d as unknown as Record<string, ContactResponse[]>)).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchPipeline();
  }, [fetchPipeline]);

  const handleDragStart = (e: DragStartEvent) => {
    const c = Object.values(pipeline).flat().find(c => c.id === e.active.id);
    if (c) setDragging(c);
  };

  const handleDragEnd = async (e: DragEndEvent) => {
    setDragging(null);
    const { active, over } = e;
    if (!over) return;
    const contactId = active.id as string;
    const targetStage = over.id as string;
    const contact = Object.values(pipeline).flat().find(c => c.id === contactId);
    if (!contact || contact.pipelineStage === targetStage) return;
    // Optimistic update
    const newPipeline = { ...pipeline };
    for (const stage of ACTIVE_STAGES) newPipeline[stage] = (newPipeline[stage] || []).filter(c => c.id !== contactId);
    newPipeline[targetStage] = [...(newPipeline[targetStage] || []), { ...contact, pipelineStage: targetStage }];
    setPipeline(newPipeline);
    try { await pipelineApi.updateStage(contactId, targetStage); } catch { /* revert */ }
  };

  const total = Object.values(pipeline).reduce((s, a) => s + a.length, 0);

  if (loading) return <div className="flex h-full items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--primary)' }} /></div>;

  return (
    <div data-testid="pipeline-page" className="flex h-full flex-col overflow-hidden px-4 py-2">
      {/* Header */}
      <div className="clay-card-sm flex items-center justify-between px-8 py-5 mb-4 shrink-0" style={{ borderRadius: 20 }}>
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text)', fontFamily: 'var(--font-heading)' }}>Investor Pipeline</h1>
          <p className="text-[14px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{total} contacts across {ACTIVE_STAGES.length} stages. Drag to move.</p>
        </div>
        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="clay-btn clay-btn-sm flex items-center gap-2"
        >
          <Plus className="h-4 w-4" /> Add Contact
        </button>
      </div>

      {/* Board */}
      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex-1 overflow-x-auto px-4 pb-4">
          <div className="flex h-full gap-4 min-w-max">
            {ACTIVE_STAGES.map(s => <StageColumn key={s} stageId={s} contacts={pipeline[s] || []} onAction={() => {}} />)}
          </div>
        </div>
        <DragOverlay>
          {dragging && (
            <div className="clay-card p-4 w-[260px] rotate-2" style={{ boxShadow: 'var(--shadow-float)' }}>
              <p className="text-[14px] font-semibold" style={{ color: 'var(--text)' }}>{dragging.name || dragging.email.split('@')[0]}</p>
              <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{dragging.email}</p>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Add Contact Modal */}
      {isAddModalOpen && (
        <AddContactModal 
          onClose={() => setIsAddModalOpen(false)} 
          onSuccess={() => {
            setIsAddModalOpen(false);
            fetchPipeline();
          }}
        />
      )}
    </div>
  );
}
