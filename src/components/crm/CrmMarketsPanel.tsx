import React, { useEffect, useState } from 'react';
import type { Project } from '../../types';
import type { ApiUser, AssetTimerPatch } from '../../api';
import { apiAssetPulse } from '../../api';
import { Card, Btn, Input, Select } from './ui';
import { Trash2 } from 'lucide-react';
import { sanitizeDecimal, sanitizeInteger, parseNumber } from '../../utils/number';

function fillTone(pct: number) {
  if (pct < 33) return { bar: 'bg-rose-500', label: 'text-rose-700' };
  if (pct < 66) return { bar: 'bg-amber-500', label: 'text-amber-800' };
  return { bar: 'bg-emerald-600', label: 'text-emerald-700' };
}

function remainingLabel(closesAt?: string | null) {
  if (!closesAt) return 'No timer';
  const ms = new Date(closesAt).getTime() - Date.now();
  if (ms <= 0) return 'Timer ended';
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  if (d > 0) return `${d}d ${h}h ${m}m ${s}s left`;
  if (h > 0) return `${h}h ${m}m ${s}s left`;
  if (m > 0) return `${m}m ${s}s left`;
  return `${s}s left`;
}

type TimerFields = AssetTimerPatch;

export const CrmMarketsPanel: React.FC<{
  projects: Project[];
  users?: ApiUser[];
  onUpdate?: (id: string, patch: Partial<Project> & TimerFields) => void;
  onDelete?: (id: string) => void;
  onNotify?: (m: string) => void;
  onRefresh?: () => void;
}> = ({ projects, users = [], onUpdate, onDelete, onNotify, onRefresh }) => {
  const [editId, setEditId] = useState<string | null>(null);
  const editing = projects.find(p => p.id === editId) || null;
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [pulse, setPulse] = useState({ assetId: '', amount: '', name: '', userId: '', notifyAll: false });
  const [clientQuery, setClientQuery] = useState('');
  const [sending, setSending] = useState(false);
  const [cardTimer, setCardTimer] = useState<Record<string, { d: string; h: string; m: string }>>({});
  const [, setNowTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setNowTick(n => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const tOf = (id: string) => cardTimer[id] || { d: '', h: '', m: '' };
  const setT = (id: string, k: 'd' | 'h' | 'm', v: string) =>
    setCardTimer(prev => ({ ...prev, [id]: { ...tOf(id), [k]: sanitizeInteger(v) } }));

  const timerPatchFrom = (t: { d: string; h: string; m: string }): TimerFields => ({
    timerDays: parseNumber(t.d, 0),
    timerHours: parseNumber(t.h, 0),
    timerMinutes: parseNumber(t.m, 0),
  });

  const startEdit = (p: Project) => {
    setEditId(p.id);
    setDraft({
      title: p.title || '',
      category: String(p.category || 'crypto'),
      categoryLabel: p.categoryLabel || '',
      apr: String(p.apr ?? ''),
      termMonths: String(p.termMonths ?? ''),
      minCheck: String(p.minCheck ?? ''),
      targetAmount: String(p.targetAmount ?? ''),
      raisedAmount: String(p.raisedAmount ?? ''),
      riskLevel: p.riskLevel || 'medium',
      description: p.description || '',
      imageUrl: p.imageUrl || '',
      timerDays: '',
      timerHours: '',
      timerMinutes: '',
    });
  };

  const set = (k: string, v: string) => setDraft(d => ({ ...d, [k]: v }));

  const save = () => {
    if (!editing) return;
    const touched =
      draft.timerDays !== '' || draft.timerHours !== '' || draft.timerMinutes !== '';
    onUpdate?.(editing.id, {
      title: draft.title,
      category: draft.category as Project['category'],
      categoryLabel: draft.categoryLabel,
      apr: parseNumber(draft.apr, 0),
      termMonths: parseNumber(draft.termMonths, 0),
      minCheck: parseNumber(draft.minCheck, 0),
      targetAmount: parseNumber(draft.targetAmount, 0),
      raisedAmount: parseNumber(draft.raisedAmount, 0),
      riskLevel: (draft.riskLevel as Project['riskLevel']) || 'medium',
      description: draft.description,
      imageUrl: draft.imageUrl,
      ...(touched
        ? {
            timerDays: parseNumber(draft.timerDays, 0),
            timerHours: parseNumber(draft.timerHours, 0),
            timerMinutes: parseNumber(draft.timerMinutes, 0),
          }
        : {}),
    });
    setEditId(null);
  };

  const clients = users.filter(u => u.role === 'CLIENT');
  const q = clientQuery.trim().toLowerCase();
  const filteredClients = (() => {
    const list = q
      ? clients.filter(c => `${c.name} ${c.email} ${c.phone || ''}`.toLowerCase().includes(q))
      : clients;
    if (pulse.userId && !list.some(c => String(c.id) === pulse.userId)) {
      const picked = clients.find(c => String(c.id) === pulse.userId);
      if (picked) return [picked, ...list];
    }
    return list;
  })();

  return (
    <div className="space-y-4">
      <Card title="Live pulse" subtitle="Show a deposit on an offer and notify the client you are sitting with">
        <form
          className="p-5 grid grid-cols-1 md:grid-cols-2 gap-3"
          onSubmit={async e => {
            e.preventDefault();
            if (sending || !pulse.assetId) return;
            setSending(true);
            try {
              const r = await apiAssetPulse(pulse.assetId.replace(/^srv-/, ''), {
                amount: parseNumber(pulse.amount, 0),
                clientName: pulse.name || clients.find(c => String(c.id) === pulse.userId)?.name,
                userId: pulse.notifyAll ? undefined : (pulse.userId ? Number(pulse.userId) : undefined),
                notifyAll: pulse.notifyAll,
              });
              onNotify?.(r.message);
              onRefresh?.();
            } catch (err) {
              onNotify?.(err instanceof Error ? err.message : 'Could not send the pulse');
            } finally {
              setSending(false);
            }
          }}
        >
          <div>
            <label className="text-[11px] font-bold uppercase text-[#213532]/70">Offer</label>
            <Select className="w-full mt-1" value={pulse.assetId} onChange={e => setPulse(p => ({ ...p, assetId: e.target.value }))}>
              <option value="">Select offer…</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
            </Select>
          </div>
          <div>
            <label className="text-[11px] font-bold uppercase text-[#213532]/70">Amount $</label>
            <Input className="w-full mt-1" inputMode="decimal" value={pulse.amount} onChange={e => setPulse(p => ({ ...p, amount: sanitizeDecimal(e.target.value) }))} />
          </div>
          <div>
            <label className="text-[11px] font-bold uppercase text-[#213532]/70">Display name</label>
            <Input className="w-full mt-1" value={pulse.name} onChange={e => setPulse(p => ({ ...p, name: e.target.value }))} />
          </div>
          <div>
            <label className="text-[11px] font-bold uppercase text-[#213532]/70">Notify client</label>
            <Input
              className="w-full mt-1"
              placeholder="Search by name or email…"
              value={clientQuery}
              onChange={e => setClientQuery(e.target.value)}
            />
            <Select className="w-full mt-2" value={pulse.notifyAll ? 'all' : pulse.userId} onChange={e => {
              if (e.target.value === 'all') setPulse(p => ({ ...p, notifyAll: true, userId: '' }));
              else setPulse(p => ({ ...p, notifyAll: false, userId: e.target.value }));
            }}>
              <option value="">Nobody — only bump the bar</option>
              <option value="all">All clients</option>
              {filteredClients.map(c => <option key={c.id} value={c.id}>{c.name} · {c.email}</option>)}
            </Select>
            {q && (
              <div className="text-[11px] text-[#213532]/55 mt-1">
                {filteredClients.length === 0 ? 'No clients match' : `${filteredClients.length} match${filteredClients.length === 1 ? '' : 'es'}`}
              </div>
            )}
          </div>
          <div className="md:col-span-2">
            <Btn variant="gold" type="submit" disabled={sending || !pulse.assetId}>Send live update</Btn>
          </div>
        </form>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {projects.map(p => {
          const pct = p.targetAmount > 0 ? Math.min(100, Math.round((Number(p.raisedAmount) / Number(p.targetAmount)) * 100)) : 0;
          const tone = fillTone(pct);
          return (
          <Card key={p.id} className="overflow-hidden">
            <div className="h-36 bg-[#F5F2E9] flex items-center justify-center text-[12px] text-[#213532]/40">
              {p.imageUrl ? (
                <img src={p.imageUrl} alt="" className="w-full h-full object-cover" onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
              ) : 'No photo'}
            </div>
            <div className="p-4 space-y-2">
              <div className="font-bold text-[#1C412C]">{p.title}</div>
              <div className="text-[12px] text-[#213532]/70">{p.categoryLabel} · {p.apr}% APR · {p.termMonths} mo · {p.status}</div>
              <div className="pt-1">
                <div className="flex justify-between text-[11px] font-semibold mb-1">
                  <span className={tone.label}>Raised ${Number(p.raisedAmount || 0).toLocaleString('en-US')}</span>
                  <span>{pct}%</span>
                </div>
                <div className="h-2 bg-[#EFEAD9] rounded-full overflow-hidden">
                  <div className={`h-full ${tone.bar}`} style={{ width: `${pct}%` }} />
                </div>
                <div className="text-[11px] text-[#213532]/60 mt-1">Target ${Number(p.targetAmount || 0).toLocaleString('en-US')} · {remainingLabel(p.closesAt)}</div>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-2">
                <div>
                  <label className="text-[10px] font-bold uppercase text-[#213532]/50">Days</label>
                  <Input className="w-full" inputMode="numeric" placeholder="0" value={tOf(p.id).d} onChange={e => setT(p.id, 'd', e.target.value)} />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-[#213532]/50">Hours</label>
                  <Input className="w-full" inputMode="numeric" placeholder="0" value={tOf(p.id).h} onChange={e => setT(p.id, 'h', e.target.value)} />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-[#213532]/50">Minutes</label>
                  <Input className="w-full" inputMode="numeric" placeholder="0" value={tOf(p.id).m} onChange={e => setT(p.id, 'm', e.target.value)} />
                </div>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <Btn size="sm" variant="gold" onClick={() => startEdit(p)}>Edit</Btn>
                <Btn size="sm" variant="ghost" onClick={() => {
                  const t = tOf(p.id);
                  if (!t.d && !t.h && !t.m) {
                    onNotify?.('Set days, hours or minutes first');
                    return;
                  }
                  onUpdate?.(p.id, timerPatchFrom(t));
                }}>Set timer</Btn>
                <Btn size="sm" variant="ghost" onClick={() => onUpdate?.(p.id, { timerDays: 0, timerHours: 0, timerMinutes: 0 })}>Clear timer</Btn>
                {p.status === 'closed' && (
                  <Btn size="sm" variant="success" onClick={() => {
                    const t = tOf(p.id);
                    if (!t.d && !t.h && !t.m) {
                      onNotify?.('Set days, hours or minutes, then reopen');
                      return;
                    }
                    onUpdate?.(p.id, { status: 'active', ...timerPatchFrom(t) });
                  }}>Reopen</Btn>
                )}
                <Btn size="sm" variant="danger" icon={Trash2} onClick={() => {
                  if (confirm(`Delete «${p.title}»?`)) onDelete?.(p.id);
                }}>Delete</Btn>
              </div>
            </div>
          </Card>
          );
        })}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-white border border-[#E4DECB] rounded-2xl max-w-lg w-full p-6 space-y-3 max-h-[90vh] overflow-y-auto">
            <h3 className="text-[16px] font-bold text-[#1C412C]">Edit asset</h3>
            <label className="text-[11px] font-bold uppercase text-[#213532]/70">Title</label>
            <Input className="w-full" value={draft.title} onChange={e => set('title', e.target.value)} />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-bold uppercase text-[#213532]/70">APR %</label>
                <Input className="w-full" inputMode="decimal" value={draft.apr} onChange={e => set('apr', sanitizeDecimal(e.target.value))} />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase text-[#213532]/70">Term (months)</label>
                <Input className="w-full" inputMode="numeric" value={draft.termMonths} onChange={e => set('termMonths', sanitizeInteger(e.target.value))} />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase text-[#213532]/70">Min amount $</label>
                <Input className="w-full" inputMode="decimal" value={draft.minCheck} onChange={e => set('minCheck', sanitizeDecimal(e.target.value))} />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase text-[#213532]/70">Target $</label>
                <Input className="w-full" inputMode="decimal" value={draft.targetAmount} onChange={e => set('targetAmount', sanitizeDecimal(e.target.value))} />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase text-[#213532]/70">Raised $</label>
                <Input className="w-full" inputMode="decimal" value={draft.raisedAmount} onChange={e => set('raisedAmount', sanitizeDecimal(e.target.value))} />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase text-[#213532]/70">Timer days</label>
                <Input className="w-full" inputMode="numeric" placeholder="0" value={draft.timerDays} onChange={e => set('timerDays', sanitizeInteger(e.target.value))} />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase text-[#213532]/70">Hours</label>
                <Input className="w-full" inputMode="numeric" placeholder="0" value={draft.timerHours} onChange={e => set('timerHours', sanitizeInteger(e.target.value))} />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase text-[#213532]/70">Minutes</label>
                <Input className="w-full" inputMode="numeric" placeholder="0" value={draft.timerMinutes} onChange={e => set('timerMinutes', sanitizeInteger(e.target.value))} />
              </div>
            </div>
            <p className="text-[11px] text-[#213532]/55">Leave days/hours/minutes empty to keep the current deadline. Fill any of them to start a new countdown from now (0/0/0 turns the timer off).</p>
            <label className="text-[11px] font-bold uppercase text-[#213532]/70">Risk</label>
            <Select className="w-full" value={draft.riskLevel} onChange={e => set('riskLevel', e.target.value)}>
              <option value="low">low</option>
              <option value="medium">medium</option>
              <option value="high">high</option>
            </Select>
            <label className="text-[11px] font-bold uppercase text-[#213532]/70">Category label</label>
            <Input className="w-full" value={draft.categoryLabel} onChange={e => set('categoryLabel', e.target.value)} />
            <label className="text-[11px] font-bold uppercase text-[#213532]/70">Photo</label>
            {draft.imageUrl ? (
              <img src={draft.imageUrl} alt="" className="h-28 w-full object-cover rounded-xl border border-[#E4DECB]" />
            ) : null}
            <Input className="w-full" placeholder="https://… or upload a file" value={draft.imageUrl.startsWith('data:') ? '' : draft.imageUrl} onChange={e => set('imageUrl', e.target.value)} />
            <input type="file" accept="image/*" onChange={e => {
              const f = e.target.files?.[0];
              if (!f) return;
              const r = new FileReader();
              r.onload = () => set('imageUrl', String(r.result || ''));
              r.readAsDataURL(f);
            }} />
            <label className="text-[11px] font-bold uppercase text-[#213532]/70">Description</label>
            <textarea rows={3} className="w-full px-3 py-2 border border-[#E4DECB] rounded-xl text-[13px]" value={draft.description} onChange={e => set('description', e.target.value)} />
            <div className="flex justify-end gap-2 pt-2">
              <Btn variant="ghost" onClick={() => setEditId(null)}>Cancel</Btn>
              <Btn variant="gold" onClick={save}>Save</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
