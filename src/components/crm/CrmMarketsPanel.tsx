import React, { useState } from 'react';
import type { Project } from '../../types';
import { Card, Btn, Input, Select } from './ui';
import { Plus, Trash2 } from 'lucide-react';

export const CrmMarketsPanel: React.FC<{
  projects: Project[];
  onCreate: () => void;
  onUpdate?: (id: string, patch: Partial<Project>) => void;
  onDelete?: (id: string) => void;
}> = ({ projects, onCreate, onUpdate, onDelete }) => {
  const [editId, setEditId] = useState<string | null>(null);
  const editing = projects.find(p => p.id === editId) || null;
  const [draft, setDraft] = useState<Partial<Project>>({});

  const startEdit = (p: Project) => {
    setEditId(p.id);
    setDraft({
      title: p.title,
      category: p.category,
      categoryLabel: p.categoryLabel,
      apr: p.apr,
      termMonths: p.termMonths,
      minCheck: p.minCheck,
      targetAmount: p.targetAmount,
      riskLevel: p.riskLevel,
      description: p.description,
      imageUrl: p.imageUrl,
      status: p.status,
      tags: p.tags,
    });
  };

  const set = (k: keyof Project, v: unknown) => setDraft(d => ({ ...d, [k]: v }));

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Btn variant="gold" icon={Plus} onClick={onCreate}>New asset</Btn>
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {projects.map(p => (
          <Card key={p.id} className="overflow-hidden">
            <div className="h-36 bg-[#F5F2E9]">
              {p.imageUrl ? <img src={p.imageUrl} alt="" className="w-full h-full object-cover" /> : null}
            </div>
            <div className="p-4 space-y-2">
              <div className="font-bold text-[#1C412C]">{p.title}</div>
              <div className="text-[12px] text-[#213532]/70">{p.categoryLabel} · {p.apr}% APR · {p.termMonths} mo · min ${p.minCheck.toLocaleString('en-US')} · {p.riskLevel} risk</div>
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
            <Input className="w-full" value={String(draft.title || '')} onChange={e => set('title', e.target.value)} />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-bold uppercase text-[#213532]/70">APR %</label>
                <Input className="w-full" value={String(draft.apr ?? '')} onChange={e => set('apr', Number(e.target.value) || 0)} />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase text-[#213532]/70">Term (months)</label>
                <Input className="w-full" value={String(draft.termMonths ?? '')} onChange={e => set('termMonths', Number(e.target.value) || 0)} />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase text-[#213532]/70">Min amount $</label>
                <Input className="w-full" value={String(draft.minCheck ?? '')} onChange={e => set('minCheck', Number(e.target.value) || 0)} />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase text-[#213532]/70">Target $</label>
                <Input className="w-full" value={String(draft.targetAmount ?? '')} onChange={e => set('targetAmount', Number(e.target.value) || 0)} />
              </div>
            </div>
            <label className="text-[11px] font-bold uppercase text-[#213532]/70">Risk</label>
            <Select className="w-full" value={String(draft.riskLevel || 'medium')} onChange={e => set('riskLevel', e.target.value)}>
              <option value="low">low</option>
              <option value="medium">medium</option>
              <option value="high">high</option>
            </Select>
            <label className="text-[11px] font-bold uppercase text-[#213532]/70">Category label</label>
            <Input className="w-full" value={String(draft.categoryLabel || '')} onChange={e => set('categoryLabel', e.target.value)} />
            <label className="text-[11px] font-bold uppercase text-[#213532]/70">Photo URL</label>
            <Input className="w-full" value={String(draft.imageUrl || '')} onChange={e => set('imageUrl', e.target.value)} />
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
              value={String(draft.description || '')}
              onChange={e => set('description', e.target.value)}
            />
            <div className="flex justify-end gap-2 pt-2">
              <Btn variant="ghost" onClick={() => setEditId(null)}>Cancel</Btn>
              <Btn variant="gold" onClick={() => { onUpdate?.(editing.id, draft); setEditId(null); }}>Save</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
