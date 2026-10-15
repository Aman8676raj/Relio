'use client';

import { useState } from 'react';
import { Plus, X, Loader2 } from 'lucide-react';
import { contactsApi } from '@/lib/api';

interface AddContactModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function AddContactModal({ onClose, onSuccess }: AddContactModalProps) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [notes, setNotes] = useState('');
  const [pipelineStage, setPipelineStage] = useState('none');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await contactsApi.create({ email, name, company, notes, pipelineStage });
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create contact');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="clay-card-deep w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200" 
        style={{ borderRadius: 32, background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <div className="px-8 pt-8 pb-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold" style={{ color: 'var(--text)', fontFamily: 'var(--font-heading)' }}>Add Contact</h2>
          <button onClick={onClose} className="p-2 rounded-xl transition-colors hover:bg-gray-100">
            <X className="h-5 w-5" style={{ color: 'var(--text-muted)' }} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-8 pb-8 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-red-50 text-red-600 text-[13px] font-medium border border-red-100">
              {error}
            </div>
          )}
          
          <div className="space-y-1.5">
            <label className="text-[12px] font-bold uppercase tracking-wider pl-1" style={{ color: 'var(--text-muted)' }}>Email Address *</label>
            <input 
              required type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="investor@fund.com"
              className="clay-input w-full text-[14px]"
              style={{ borderRadius: 16, padding: '12px 16px' }}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[12px] font-bold uppercase tracking-wider pl-1" style={{ color: 'var(--text-muted)' }}>Name</label>
              <input 
                type="text" value={name} onChange={e => setName(e.target.value)}
                placeholder="Jane Doe"
                className="clay-input w-full text-[14px]"
                style={{ borderRadius: 16, padding: '12px 16px' }}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[12px] font-bold uppercase tracking-wider pl-1" style={{ color: 'var(--text-muted)' }}>Company</label>
              <input 
                type="text" value={company} onChange={e => setCompany(e.target.value)}
                placeholder="Sequoia"
                className="clay-input w-full text-[14px]"
                style={{ borderRadius: 16, padding: '12px 16px' }}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[12px] font-bold uppercase tracking-wider pl-1" style={{ color: 'var(--text-muted)' }}>Pipeline Stage</label>
            <div className="relative">
              <select 
                value={pipelineStage} onChange={e => setPipelineStage(e.target.value)}
                className="clay-input w-full text-[14px] appearance-none"
                style={{ borderRadius: 16, padding: '12px 16px' }}
              >
                <option value="none">No Stage</option>
                <option value="intro">Intro Received</option>
                <option value="meeting">Meeting Booked</option>
                <option value="dd">Due Diligence</option>
                <option value="term_sheet">Term Sheet</option>
                <option value="closed_won">Closed Won</option>
                <option value="closed_lost">Closed Lost</option>
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none opacity-50">
                <Plus className="h-3.5 w-3.5 rotate-45" />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[12px] font-bold uppercase tracking-wider pl-1" style={{ color: 'var(--text-muted)' }}>Notes</label>
            <textarea 
              value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Background, warm path, etc..."
              rows={3}
              className="clay-input w-full text-[14px] resize-none"
              style={{ borderRadius: 16, padding: '12px 16px' }}
            />
          </div>

          <div className="pt-4">
            <button 
              type="submit" 
              disabled={saving}
              className="clay-btn w-full py-4 text-[15px] font-bold flex items-center justify-center gap-2"
              style={{ borderRadius: 18 }}
            >
              {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
              {saving ? 'Creating...' : 'Create Contact'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
