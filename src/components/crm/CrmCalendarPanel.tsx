import React, { useEffect, useMemo, useState } from 'react';
import type { ApiUser } from '../../api';
import {
  apiAppointments,
  apiCreateAppointment,
  apiDeleteAppointment,
} from '../../api';
import type { ApiAppointment } from '../../api';
import { Card, Btn, Input, Select } from './ui';
import { ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';

function startOfWeek(d: Date) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7;
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - day);
  return x;
}

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function hmLocal(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const HOURS = Array.from({ length: 13 }, (_, i) => i + 8);

export const CrmCalendarPanel: React.FC<{
  users: ApiUser[];
  onOpenClient: (userId: number) => void;
  onNotify: (m: string) => void;
}> = ({ users, onOpenClient, onNotify }) => {
  const clients = users.filter(u => u.role === 'CLIENT');
  const [weekAnchor, setWeekAnchor] = useState(() => startOfWeek(new Date()));
  const [items, setItems] = useState<ApiAppointment[]>([]);
  const [query, setQuery] = useState('');
  const [clientId, setClientId] = useState('');
  const [when, setWhen] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekAnchor, i)), [weekAnchor]);

  const load = async () => {
    try {
      const r = await apiAppointments();
      setItems(r.appointments);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Could not load calendar');
    }
  };

  useEffect(() => { load(); }, []);

  const filteredClients = query.trim()
    ? clients.filter(c => `${c.name} ${c.email}`.toLowerCase().includes(query.trim().toLowerCase()))
    : clients;

  const eventsOn = (day: Date) => {
    const key = ymd(day);
    return items.filter(a => ymd(new Date(a.startsAt)) === key);
  };

  return (
    <div className="space-y-4">
      <Card title="New reminder" subtitle="Pick a client and a time — click their name later to open the profile">
        <form
          className="p-5 grid grid-cols-1 md:grid-cols-2 gap-3"
          onSubmit={async e => {
            e.preventDefault();
            if (!clientId || !when || saving) return;
            setSaving(true);
            try {
              await apiCreateAppointment({
                clientId: Number(clientId),
                startsAt: new Date(when).toISOString(),
                notes,
              });
              setNotes('');
              await load();
              onNotify('Reminder saved.');
            } catch (err) {
              onNotify(err instanceof Error ? err.message : 'Could not save');
            } finally {
              setSaving(false);
            }
          }}
        >
          <div>
            <label className="text-[11px] font-bold uppercase text-[#213532]/70">Find client</label>
            <Input className="w-full mt-1" placeholder="Name or email…" value={query} onChange={e => setQuery(e.target.value)} />
            <Select className="w-full mt-2" value={clientId} onChange={e => setClientId(e.target.value)}>
              <option value="">Select client…</option>
              {filteredClients.map(c => (
                <option key={c.id} value={c.id}>{c.name} · {c.email}</option>
              ))}
            </Select>
          </div>
          <div>
            <label className="text-[11px] font-bold uppercase text-[#213532]/70">Date & time</label>
            <Input className="w-full mt-1" type="datetime-local" value={when} onChange={e => setWhen(e.target.value)} />
            <label className="text-[11px] font-bold uppercase text-[#213532]/70 mt-2 block">Note</label>
            <Input className="w-full mt-1" placeholder="Call, KYC, deposit…" value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Btn variant="gold" type="submit" disabled={saving || !clientId || !when}>Save reminder</Btn>
          </div>
        </form>
      </Card>

      <Card
        title="Week"
        subtitle={`${days[0].toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} – ${days[6].toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`}
        actions={
          <div className="flex items-center gap-2">
            <Btn size="sm" variant="ghost" icon={ChevronLeft} onClick={() => setWeekAnchor(d => addDays(d, -7))}>Prev</Btn>
            <Btn size="sm" variant="ghost" onClick={() => setWeekAnchor(startOfWeek(new Date()))}>Today</Btn>
            <Btn size="sm" variant="ghost" icon={ChevronRight} onClick={() => setWeekAnchor(d => addDays(d, 7))}>Next</Btn>
          </div>
        }
      >
        <div className="overflow-x-auto">
          <div className="min-w-[860px] grid grid-cols-8 border-t border-[#E4DECB]">
            <div className="p-2 text-[10px] font-bold uppercase text-[#213532]/40">Time</div>
            {days.map(d => (
              <div key={ymd(d)} className={`p-2 text-center border-l border-[#E4DECB] ${ymd(d) === ymd(new Date()) ? 'bg-[#B08B48]/10' : ''}`}>
                <div className="text-[10px] font-bold uppercase text-[#213532]/50">
                  {d.toLocaleDateString('en-US', { weekday: 'short' })}
                </div>
                <div className="text-[16px] font-extrabold text-[#1C412C]">{d.getDate()}</div>
              </div>
            ))}
            {HOURS.map(h => (
              <React.Fragment key={h}>
                <div className="px-2 py-3 text-[11px] text-[#213532]/50 border-t border-[#E4DECB]">
                  {String(h).padStart(2, '0')}:00
                </div>
                {days.map(d => {
                  const slot = eventsOn(d).filter(a => new Date(a.startsAt).getHours() === h);
                  return (
                    <div key={`${ymd(d)}-${h}`} className="min-h-[56px] border-t border-l border-[#E4DECB] p-1 space-y-1">
                      {slot.map(a => (
                        <div key={a.id} className="rounded-lg bg-[#1C412C] text-[#F5F2E9] px-2 py-1.5 text-[11px]">
                          <button
                            type="button"
                            className="font-bold hover:underline text-left cursor-pointer"
                            onClick={() => onOpenClient(a.clientId)}
                          >
                            {a.clientName}
                          </button>
                          <div className="opacity-80">{hmLocal(a.startsAt)} · {a.title}</div>
                          {a.notes && <div className="opacity-70 truncate">{a.notes}</div>}
                          <button
                            type="button"
                            className="mt-1 inline-flex items-center gap-1 text-[#F5F2E9]/70 hover:text-rose-300 cursor-pointer"
                            onClick={async () => {
                              try {
                                await apiDeleteAppointment(a.id);
                                await load();
                              } catch (err) {
                                onNotify(err instanceof Error ? err.message : 'Could not delete');
                              }
                            }}
                          >
                            <Trash2 className="w-3 h-3" /> Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
};
