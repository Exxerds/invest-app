import React, { useState } from 'react';
import type { Project } from '../../types';
import { Card, Btn, Input, Select } from './ui';
import { Trash2 } from 'lucide-react';
import { sanitizeDecimal, sanitizeInteger, parseNumber } from '../../utils/number';

export const CrmMarketsPanel: React.FC<{
  projects: Project[];
  onUpdate?: (id: string, patch: Partial<Project>) => void;
  onDelete?: (id: string) => void;
}> = ({ projects, onUpdate, onDelete }) => {
  const [editId, setEditId] = useState<string | null>(null);
  const editing = projects.find(p => p.id === editId) || null;
  const [draft, setDraft] = useState<Record<string, string>>({});

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
      riskLevel: p.riskLevel || 'medium',
      description: p.description || '',
      imageUrl: p.imageUrl || '',
    });
  };

  const set = (k: string, v: string) => setDraft(d => ({ ...d, [k]: v }));

  const save = () => {
    if (!editing) return;
    onUpdate?.(editing.id, {
      title: draft.title,
      category: draft.category as Project['category'],
      categoryLabel: draft.categoryLabel,
      apr: parseNumber(draft.apr, 0),
      termMonths: parseNumber(draft.termMonths, 0),
      minCheck: parseNumber(draft.minCheck, 0),
      targetAmount: parseNumber(draft.targetAmount, 0),
      riskLevel: (draft.riskLevel as Project['riskLevel']) || 'medium',
      description: draft.description,
      imageUrl: draft.imageUrl,
    });
    setEditId(null);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {projects.map(p => (
          <Card key={p.id} className="overflow-hidden">
            <div className="h-36 bg-[#F5F2E9] flex items-center justify-center text-[12px] text-[#213532]/40">
              {p.imageUrl ? (
                <img
                  src={p.imageUrl}
                  alt=""
                  className="w-full h-full object-cover"
                  onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                />
              ) : (
                'No photo'
              )}
            </div>
            <div className="p-4 space-y-2">
              <div className="font-bold text-[#1C412C]">{p.title}</div>
              <div className="text-[12px] text-[#213532]/70">{p.categoryLabel} · {p.apr}% APR · {p.termMonths} mo · min ${Number(p.minCheck || 0).toLocaleString('en-US')} · {p.riskLevel} risk</div>
              <p className="text-[12px] text-[#213532]/70 line-clamp-2">{p.description}</p>
              <div className="flex gap-2 pt-1">
                <Btn size="sm" variant="gold" onClick={() => startEdit(p)}>Edit</Btn>
                <Btn size="sm" variant="danger" icon={Trash2} onClick={() => {
                  if (confirm(`Delete «${p.title}»?`)) onDelete?.(p.id);
                }}>Delete</Btn>
              </div>
            </div>
          </Card>
        ))}
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
            </div>
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
            <input
              type="file"
              accept="image/*"
              onChange={e => {
                const f = e.target.files?.[0];
                if (!f) return;
                const r = new FileReader();
                r.onload = () => set('imageUrl', String(r.result || ''));
                r.readAsDataURL(f);
              }}
            />
            <label className="text-[11px] font-bold uppercase text-[#213532]/70">Description</label>
            <textarea
              rows={3}
              className="w-full px-3 py-2 border border-[#E4DECB] rounded-xl text-[13px]"
              value={draft.description}
              onChange={e => set('description', e.target.value)}
            />
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
