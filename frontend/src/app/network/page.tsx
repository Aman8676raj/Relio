'use client';

import { useState, useEffect, useCallback, useMemo, useRef, memo } from 'react';
import { ReactFlow, Background, Controls, type Node, type Edge, type NodeTypes, Handle, Position, useNodesState, useEdgesState, BackgroundVariant, applyNodeChanges, type NodeChange } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { forceSimulation, forceManyBody, forceLink, forceCenter, forceCollide, forceX, forceY, type SimulationNodeDatum, type SimulationLinkDatum } from 'd3-force';
import { contactsApi, introPathApi, type ContactResponse, type IntroPathResult } from '@/lib/api';
import { Loader2, RefreshCw, Users, Network, X, Waypoints, LayoutGrid, List, ChevronRight, ArrowRight } from 'lucide-react';
import { WarmthBadge } from '@/components/WarmthBadge';
import type { WarmthTier } from '@/lib/types';
import Link from 'next/link';

// ─── Types ───────────────────────────────────────────────────────────────────

type ViewMode = 'graph' | 'radial' | 'table';

interface SimNode extends SimulationNodeDatum { id: string; r: number; warmthTier: string; pipelineStage: string; contact: ContactResponse; }
interface SimLink extends SimulationLinkDatum<SimNode> { strength: number; }

const WARMTH_BG: Record<string, string> = { hot: 'var(--hot-bg)', warm: 'var(--warm-bg)', cold: 'var(--cold-bg)', frozen: 'var(--frozen-bg)' };
const WARMTH_COLOR: Record<string, string> = { hot: 'var(--hot-text)', warm: 'var(--warm-text)', cold: 'var(--cold-text)', frozen: 'var(--frozen-text)' };
const STAGE_RING: Record<string, string> = { closed_won: '#2D8C5A', term_sheet: '#D35C3E', dd: '#E09A36', meeting: '#2C5B6B', intro: '#8A8078' };
const STAGE_LABELS: Record<string, string> = { none: 'None', intro: 'Intro', meeting: 'Meeting', dd: 'DD', term_sheet: 'Term Sheet', closed_won: 'Won', closed_lost: 'Lost', paused: 'Paused' };

function timeAgo(d: string | null): string {
  if (!d) return 'Never';
  const diff = Date.now() - new Date(d).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return '1d ago';
  return `${days}d ago`;
}

function getInitials(name: string | null, email: string) {
  if (name) return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  return email[0].toUpperCase();
}

// ─── Graph View: Custom Node ─────────────────────────────────────────────────

const ContactNode = memo(function ContactNode({ data, selected }: { data: any; selected: boolean }) {
  const size = data.r * 2;
  return (
    <div style={{ width: size, height: size, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {STAGE_RING[data.pipelineStage] && (
        <div style={{ position: 'absolute', inset: -3, borderRadius: '50%', border: `2.5px solid ${STAGE_RING[data.pipelineStage]}`, opacity: selected ? 1 : 0.6, pointerEvents: 'none' }} />
      )}
      <div style={{
        width: size, height: size, borderRadius: '50%',
        background: WARMTH_BG[data.warmthTier] || 'var(--bg)',
        border: selected ? '2px solid var(--primary)' : '1.5px solid var(--border)',
        boxShadow: selected ? '0 0 0 3px rgba(211,92,62,0.12), var(--shadow-clay-sm)' : 'var(--shadow-clay-sm)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s ease',
      }}>
        <Handle type="target" position={Position.Top} style={{ opacity: 0, pointerEvents: 'none' }} />
        <Handle type="source" position={Position.Bottom} style={{ opacity: 0, pointerEvents: 'none' }} />
        <span style={{ fontSize: Math.max(9, data.r * 0.38), fontWeight: 700, color: 'var(--text)', userSelect: 'none', fontFamily: 'var(--font-heading)' }}>{data.initials}</span>
      </div>
      <div style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: 6, textAlign: 'center', pointerEvents: 'none', whiteSpace: 'nowrap' }}>
        <p style={{ fontSize: Math.max(9, Math.min(11, data.r * 0.3)), fontWeight: 600, color: 'var(--text)', maxWidth: data.r * 3, overflow: 'hidden', textOverflow: 'ellipsis' }}>{data.label}</p>
      </div>
    </div>
  );
});

const NODE_TYPES: NodeTypes = { contact: ContactNode as any };

function computeRadius(c: ContactResponse): number {
  const warmth = c.warmthScore ?? 0;
  const emails = Math.min(c.totalEmails, 80);
  return Math.max(18, Math.min(50, 18 + (warmth / 100) * 20 + emails * 0.2));
}

// ─── Graph View ──────────────────────────────────────────────────────────────

function GraphView({ contacts, paths, onSelect }: { contacts: ContactResponse[]; paths: IntroPathResult[]; onSelect: (c: ContactResponse | null) => void }) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const simRef = useRef<any>(null);
  const simNodeMap = useRef<Map<string, SimNode>>(new Map());
  const rafRef = useRef<number>(0);

  const runSimulation = useCallback((cts: ContactResponse[], pts: IntroPathResult[]) => {
    if (simRef.current) { simRef.current.stop(); cancelAnimationFrame(rafRef.current); }
    if (!cts.length) { setNodes([]); setEdges([]); return; }
    const simNodes: SimNode[] = cts.map(c => ({ id: c.id, r: computeRadius(c), warmthTier: c.warmthTier, pipelineStage: c.pipelineStage ?? 'none', contact: c, x: (Math.random() - 0.5) * 400, y: (Math.random() - 0.5) * 400 }));
    const nodeMap = new Map(simNodes.map(n => [n.id, n]));
    const simLinks: SimLink[] = pts.filter(p => nodeMap.has(p.sourceContact.id) && nodeMap.has(p.targetContact.id)).map(p => ({ source: p.sourceContact.id, target: p.targetContact.id, strength: p.strengthScore }));
    simNodeMap.current = nodeMap;
    const rfNodes: Node[] = simNodes.map(sn => {
      const c = sn.contact; const label = c.name || c.email.split('@')[0];
      const initials = label.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);
      return { id: sn.id, type: 'contact', position: { x: sn.x!, y: sn.y! }, data: { label, initials, warmthTier: sn.warmthTier, pipelineStage: sn.pipelineStage, r: sn.r, contact: c } };
    });
    const rfEdges: Edge[] = simLinks.map(sl => {
      const isStrong = sl.strength >= 65;
      const src = typeof sl.source === 'string' ? sl.source : (sl.source as SimNode).id;
      const tgt = typeof sl.target === 'string' ? sl.target : (sl.target as SimNode).id;
      return { id: `${src}-${tgt}`, source: src, target: tgt, animated: isStrong, style: { stroke: isStrong ? 'var(--primary)' : 'var(--accent)', strokeWidth: isStrong ? 2.5 : 1.5, opacity: Math.max(0.2, sl.strength / 100) } };
    });
    setNodes(rfNodes); setEdges(rfEdges);
    const sim = forceSimulation<SimNode>(simNodes)
      .force('charge', forceManyBody<SimNode>().strength(n => -(n.r ** 1.8) * 0.9))
      .force('link', forceLink<SimNode, SimLink>(simLinks).id(d => d.id).strength(l => Math.max(0.08, (l.strength / 100) * 0.5)).distance(l => { const s = l.source as SimNode; const t = l.target as SimNode; return (s.r + t.r) * 2.2 + 50; }))
      .force('collide', forceCollide<SimNode>().radius(n => n.r + 14).strength(0.85))
      .force('x', forceX(0).strength(0.04)).force('y', forceY(0).strength(0.04))
      .force('center', forceCenter(0, 0).strength(0.12)).alphaDecay(0.022).velocityDecay(0.38);
    simRef.current = sim; sim.stop();
    for (let i = 0; i < 80; i++) sim.tick();
    setNodes(prev => prev.map(n => { const sn = simNodeMap.current.get(n.id); return sn ? { ...n, position: { x: sn.x!, y: sn.y! } } : n; }));
    sim.restart();
    sim.on('tick', () => { cancelAnimationFrame(rafRef.current); rafRef.current = requestAnimationFrame(() => { setNodes(prev => { const changes: NodeChange[] = []; for (const [id, sn] of simNodeMap.current) changes.push({ type: 'position', id, dragging: false, position: { x: sn.x!, y: sn.y! } }); return applyNodeChanges(changes, prev); }); }); });
    setTimeout(() => sim.stop(), 5000);
  }, [setNodes, setEdges]);

  useEffect(() => { runSimulation(contacts, paths); }, [contacts, paths, runSimulation]);
  useEffect(() => () => { simRef.current?.stop(); cancelAnimationFrame(rafRef.current); }, []);

  return (
    <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
      onNodeClick={(_, n) => onSelect((n.data as any).contact)} onPaneClick={() => onSelect(null)}
      nodeTypes={NODE_TYPES} fitView fitViewOptions={{ padding: 0.2, maxZoom: 1.2 }} minZoom={0.15} maxZoom={3}
      proOptions={{ hideAttribution: true }} nodesDraggable nodesConnectable={false}>
      <Background variant={BackgroundVariant.Dots} gap={28} size={1.2} color="rgba(42,35,31,0.06)" />
      <Controls showInteractive={false} style={{ bottom: 20, right: 20, left: 'auto' }} />
    </ReactFlow>
  );
}

// ─── Radial View ─────────────────────────────────────────────────────────────

function RadialView({ contacts, paths, onSelect }: { contacts: ContactResponse[]; paths: IntroPathResult[]; onSelect: (c: ContactResponse | null) => void }) {
  const tiers: WarmthTier[] = ['hot', 'warm', 'cold', 'frozen'];
  const tierRadii = [120, 220, 310, 390];
  const centerX = 450;
  const centerY = 420;

  const positioned = useMemo(() => {
    const result: { contact: ContactResponse; x: number; y: number; tier: WarmthTier }[] = [];
    tiers.forEach((tier, tierIdx) => {
      const inTier = contacts.filter(c => c.warmthTier === tier);
      const r = tierRadii[tierIdx];
      inTier.forEach((c, i) => {
        const angle = (2 * Math.PI * i) / Math.max(inTier.length, 1) - Math.PI / 2;
        result.push({ contact: c, x: centerX + r * Math.cos(angle), y: centerY + r * Math.sin(angle), tier });
      });
    });
    return result;
  }, [contacts]);

  // Build path lines
  const pathLines = useMemo(() => {
    const posMap = new Map(positioned.map(p => [p.contact.id, p]));
    return paths.map(p => {
      const src = posMap.get(p.sourceContact.id);
      const tgt = posMap.get(p.targetContact.id);
      if (!src || !tgt) return null;
      return { x1: src.x, y1: src.y, x2: tgt.x, y2: tgt.y, strength: p.strengthScore };
    }).filter(Boolean) as { x1: number; y1: number; x2: number; y2: number; strength: number }[];
  }, [positioned, paths]);

  return (
    <div className="flex-1 overflow-auto relative" data-testid="radial-view">
      <svg width="900" height="840" viewBox="0 0 900 840" className="mx-auto block" style={{ minWidth: 700 }}>
        {/* Tier rings */}
        {tierRadii.map((r, i) => (
          <g key={i}>
            <circle cx={centerX} cy={centerY} r={r} fill="none" stroke="var(--border)" strokeWidth={1} strokeDasharray="4 4" />
            <text x={centerX + r + 8} y={centerY - 4} fontSize={10} fontWeight={700} fill="var(--text-muted)" style={{ fontFamily: 'var(--font-heading)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              {tiers[i]}
            </text>
          </g>
        ))}

        {/* Intro path lines */}
        {pathLines.map((l, i) => (
          <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
            stroke={l.strength >= 65 ? 'var(--primary)' : 'var(--accent)'}
            strokeWidth={l.strength >= 65 ? 2 : 1}
            opacity={Math.max(0.15, l.strength / 100 * 0.6)} />
        ))}

        {/* Center node (You) */}
        <circle cx={centerX} cy={centerY} r={24} fill="var(--primary)" />
        <text x={centerX} y={centerY + 4} textAnchor="middle" fontSize={11} fontWeight={800} fill="white" style={{ fontFamily: 'var(--font-heading)' }}>YOU</text>

        {/* Contact nodes */}
        {positioned.map(({ contact, x, y, tier }) => {
          const size = Math.max(14, Math.min(28, 14 + (contact.warmthScore || 0) / 100 * 14));
          return (
            <g key={contact.id} className="cursor-pointer" onClick={() => onSelect(contact)}
              style={{ transition: 'transform 0.2s ease' }}
              onMouseEnter={e => { (e.currentTarget.querySelector('circle') as SVGCircleElement).setAttribute('r', String(size + 3)); }}
              onMouseLeave={e => { (e.currentTarget.querySelector('circle') as SVGCircleElement).setAttribute('r', String(size)); }}>
              <circle cx={x} cy={y} r={size} fill={WARMTH_BG[tier]} stroke={WARMTH_COLOR[tier]} strokeWidth={2} />
              <text x={x} y={y + 3} textAnchor="middle" fontSize={Math.max(8, size * 0.6)} fontWeight={700} fill={WARMTH_COLOR[tier]}
                style={{ fontFamily: 'var(--font-heading)', pointerEvents: 'none' }}>
                {getInitials(contact.name, contact.email)}
              </text>
              <text x={x} y={y + size + 14} textAnchor="middle" fontSize={9} fontWeight={600} fill="var(--text-muted)"
                style={{ pointerEvents: 'none' }}>
                {(contact.name || contact.email.split('@')[0]).slice(0, 12)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ─── Table View ──────────────────────────────────────────────────────────────

function TableView({ contacts, paths, onSelect }: { contacts: ContactResponse[]; paths: IntroPathResult[]; onSelect: (c: ContactResponse | null) => void }) {
  const [sortBy, setSortBy] = useState<'warmth' | 'emails' | 'name'>('warmth');

  const sorted = useMemo(() => {
    const arr = [...contacts];
    if (sortBy === 'warmth') arr.sort((a, b) => (b.warmthScore || 0) - (a.warmthScore || 0));
    if (sortBy === 'emails') arr.sort((a, b) => b.totalEmails - a.totalEmails);
    if (sortBy === 'name') arr.sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email));
    return arr;
  }, [contacts, sortBy]);

  const getPathCount = (id: string) => paths.filter(p => p.sourceContact.id === id || p.targetContact.id === id).length;

  return (
    <div className="flex-1 overflow-auto px-2" data-testid="table-view">
      <div className="flex items-center gap-2 mb-4 px-2">
        <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-heading)' }}>Sort by:</span>
        {(['warmth', 'emails', 'name'] as const).map(s => (
          <button key={s} onClick={() => setSortBy(s)} className="rounded-xl px-3 py-1.5 text-[12px] font-semibold transition-all"
            style={{ background: sortBy === s ? 'var(--hot-bg)' : 'transparent', color: sortBy === s ? 'var(--primary)' : 'var(--text-muted)' }}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>
      <table className="w-full">
        <thead>
          <tr>
            {['Contact', 'Company', 'Warmth', 'Pipeline', 'Emails', 'Reply Rate', 'Intro Paths', 'Last Contact'].map(h => (
              <th key={h} className="px-4 py-3 text-left text-[11px] font-bold tracking-[0.12em] uppercase"
                style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', fontFamily: 'var(--font-heading)' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map(c => (
            <tr key={c.id} data-testid={`network-row-${c.id}`} className="cursor-pointer transition-colors"
              style={{ borderBottom: '1px solid var(--border)' }}
              onClick={() => onSelect(c)}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white border-2 border-white"
                    style={{ background: `linear-gradient(135deg, ${WARMTH_COLOR[c.warmthTier]}, color-mix(in srgb, ${WARMTH_COLOR[c.warmthTier]} 60%, #000))`, boxShadow: '0 2px 6px rgba(0,0,0,0.1)' }}>
                    {getInitials(c.name, c.email)}
                  </div>
                  <div><p className="text-[13px] font-semibold" style={{ color: 'var(--text)' }}>{c.name || c.email.split('@')[0]}</p>
                    <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{c.email}</p></div>
                </div>
              </td>
              <td className="px-4 py-3 text-[13px]" style={{ color: 'var(--text-muted)' }}>{c.company || '—'}</td>
              <td className="px-4 py-3"><WarmthBadge tier={c.warmthTier as WarmthTier} /></td>
              <td className="px-4 py-3 text-[12px] font-medium" style={{ color: 'var(--text-muted)' }}>{STAGE_LABELS[c.pipelineStage] || '—'}</td>
              <td className="px-4 py-3 text-[13px] font-semibold tabular-nums" style={{ color: 'var(--text)' }}>{c.totalEmails}</td>
              <td className="px-4 py-3 text-[13px] tabular-nums" style={{ color: 'var(--text-muted)' }}>{Math.round(c.replyRate * 100)}%</td>
              <td className="px-4 py-3">
                {getPathCount(c.id) > 0 ? (
                  <span className="text-[12px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'var(--warm-bg)', color: 'var(--accent)' }}>{getPathCount(c.id)}</span>
                ) : <span className="text-[12px]" style={{ color: 'var(--text-muted)' }}>—</span>}
              </td>
              <td className="px-4 py-3 text-[12px]" style={{ color: 'var(--text-muted)' }}>{timeAgo(c.lastContactedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Detail Panel ────────────────────────────────────────────────────────────

function DetailPanel({ contact, paths, onClose }: { contact: ContactResponse; paths: IntroPathResult[]; onClose: () => void }) {
  const contactPaths = paths.filter(p => p.sourceContact.id === contact.id || p.targetContact.id === contact.id);

  return (
    <div className="clay-card w-80 shrink-0 flex flex-col animate-slide-right overflow-y-auto" style={{ borderRadius: 24 }}>
      <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
        <span className="text-[11px] font-bold tracking-[0.2em] uppercase" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-heading)' }}>Contact</span>
        <button onClick={onClose} className="opacity-40 hover:opacity-80 transition-opacity"><X className="h-4 w-4" /></button>
      </div>
      <div className="px-5 py-5 space-y-5">
        <div className="flex items-center gap-3">
          <div className="h-14 w-14 rounded-2xl flex items-center justify-center text-lg font-bold text-white border-2 border-white"
            style={{ background: 'linear-gradient(135deg, var(--primary), var(--accent))', boxShadow: 'var(--shadow-button)' }}>
            {getInitials(contact.name, contact.email)}
          </div>
          <div className="min-w-0">
            <p className="font-bold truncate text-[16px]" style={{ color: 'var(--text)', fontFamily: 'var(--font-heading)' }}>{contact.name || contact.email.split('@')[0]}</p>
            {contact.company && <p className="text-[13px] truncate" style={{ color: 'var(--text-muted)' }}>{contact.company}</p>}
          </div>
        </div>
        <div className="flex gap-2"><WarmthBadge tier={contact.warmthTier as WarmthTier} size="md" /></div>
        <div className="rounded-2xl p-4 grid grid-cols-2 gap-4" style={{ background: 'var(--bg)' }}>
          {[['Score', `${Math.round(contact.warmthScore ?? 0)}`], ['Emails', `${contact.totalEmails}`], ['Reply', `${Math.round(contact.replyRate * 100)}%`], ['Depth', contact.avgThreadDepth.toFixed(1)]].map(([l, v]) => (
            <div key={l}><p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-heading)' }}>{l}</p>
              <p className="text-lg font-bold tabular-nums" style={{ color: 'var(--text)', fontFamily: 'var(--font-heading)' }}>{v}</p></div>
          ))}
        </div>
        {contactPaths.length > 0 && (
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-heading)' }}>Intro Paths</p>
            <div className="space-y-2">
              {contactPaths.slice(0, 3).map((path, idx) => {
                const other = path.sourceContact.id === contact.id ? path.targetContact : path.sourceContact;
                return (
                  <div key={idx} className="flex items-center gap-2.5 rounded-xl p-3" style={{ background: 'var(--bg)' }}>
                    <div className="h-7 w-7 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                      style={{ background: 'linear-gradient(135deg, var(--accent), #92400e)' }}>
                      {(other.name || other.email)[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-semibold truncate" style={{ color: 'var(--text)' }}>{other.name || other.email.split('@')[0]}</p>
                      <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Strength: {Math.round(path.strengthScore)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        <Link href={`/contacts/${contact.id}`} data-testid="view-profile-btn"
          className="flex items-center justify-center gap-2 w-full rounded-2xl py-3 text-[14px] font-bold transition-all"
          style={{ background: 'var(--hot-bg)', color: 'var(--primary)' }}>
          View full profile <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// NETWORK PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export default function NetworkPage() {
  const [contacts, setContacts] = useState<ContactResponse[]>([]);
  const [paths, setPaths] = useState<IntroPathResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [computing, setComputing] = useState(false);
  const [selected, setSelected] = useState<ContactResponse | null>(null);
  const [filter, setFilter] = useState<'all' | 'pipeline' | 'hot'>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('graph');

  const filtered = useMemo(() => {
    if (filter === 'pipeline') return contacts.filter(c => c.pipelineStage !== 'none');
    if (filter === 'hot') return contacts.filter(c => c.warmthTier === 'hot' || c.warmthTier === 'warm');
    return contacts;
  }, [contacts, filter]);

  useEffect(() => {
    Promise.all([contactsApi.list({ limit: '300' }), introPathApi.getTop().catch(() => [])]).then(([c, p]) => { setContacts(c.data); setPaths(p); }).finally(() => setLoading(false));
  }, []);

  const handleCompute = async () => { setComputing(true); try { await introPathApi.compute(); } finally { setComputing(false); } };

  const VIEW_MODES: { key: ViewMode; label: string; icon: typeof Waypoints }[] = [
    { key: 'graph', label: 'Force Graph', icon: Waypoints },
    { key: 'radial', label: 'Radial Map', icon: Network },
    { key: 'table', label: 'Table', icon: List },
  ];

  return (
    <div data-testid="network-page" className="flex h-full px-4 py-2 gap-4">
      <div className="flex-1 flex flex-col min-w-0 clay-card overflow-hidden" style={{ borderRadius: 24 }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 shrink-0 flex-wrap gap-3" style={{ borderBottom: '1px solid var(--border)' }}>
          <div>
            <h1 className="text-xl font-bold tracking-tight" style={{ color: 'var(--text)', fontFamily: 'var(--font-heading)' }}>Network</h1>
            <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>{filtered.length} contacts &middot; {paths.length} paths</p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* View Mode Toggle */}
            <div className="flex rounded-2xl p-1" style={{ background: 'var(--bg)', boxShadow: 'var(--shadow-inset)' }}>
              {VIEW_MODES.map(({ key, label, icon: Icon }) => (
                <button key={key} data-testid={`view-mode-${key}`} onClick={() => setViewMode(key)}
                  className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[12px] font-semibold transition-all"
                  style={{
                    background: viewMode === key ? 'var(--surface)' : 'transparent',
                    color: viewMode === key ? 'var(--primary)' : 'var(--text-muted)',
                    boxShadow: viewMode === key ? 'var(--shadow-clay-sm)' : 'none',
                  }}>
                  <Icon className="h-3.5 w-3.5" /> {label}
                </button>
              ))}
            </div>

            {/* Filters */}
            <div className="flex gap-1.5">
              {(['all', 'pipeline', 'hot'] as const).map(k => (
                <button key={k} data-testid={`network-filter-${k}`} onClick={() => setFilter(k)}
                  className="rounded-xl px-3 py-1.5 text-[12px] font-semibold transition-all"
                  style={{
                    background: filter === k ? 'var(--hot-bg)' : 'transparent',
                    color: filter === k ? 'var(--primary)' : 'var(--text-muted)',
                  }}>
                  {k === 'all' ? 'All' : k === 'pipeline' ? 'Pipeline' : 'Hot & Warm'}
                </button>
              ))}
            </div>

            <button data-testid="recompute-btn" onClick={handleCompute} disabled={computing}
              className="clay-btn-ghost clay-btn-sm flex items-center gap-1.5 text-[12px] disabled:opacity-50">
              {computing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Recompute
            </button>
          </div>
        </div>

        {/* View Content */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--primary)' }} /></div>
        ) : contacts.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-center p-8">
            <div><Users className="h-14 w-14 mx-auto mb-4" style={{ color: 'var(--text-muted)', opacity: 0.2 }} />
              <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--text)', fontFamily: 'var(--font-heading)' }}>Empty network</h3>
              <p className="text-[14px]" style={{ color: 'var(--text-muted)' }}>Sync Gmail or add contacts to see your network.</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 relative">
            {viewMode === 'graph' && <GraphView contacts={filtered} paths={paths} onSelect={setSelected} />}
            {viewMode === 'radial' && <RadialView contacts={filtered} paths={paths} onSelect={setSelected} />}
            {viewMode === 'table' && <TableView contacts={filtered} paths={paths} onSelect={setSelected} />}
          </div>
        )}
      </div>

      {/* Detail Panel */}
      {selected && <DetailPanel contact={selected} paths={paths} onClose={() => setSelected(null)} />}
    </div>
  );
}
