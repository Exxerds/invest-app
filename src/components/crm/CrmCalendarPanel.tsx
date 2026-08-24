import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { ApiUser, ApiAppointment } from '../../api';
import {
  apiAppointments,
  apiCreateAppointment,
  apiDeleteAppointment,
} from '../../api';
import { Card, Btn, Input, Select } from './ui';
import { ChevronLeft, ChevronRight, Trash2, X } from 'lucide-react';

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

function addMinutes(d: Date, n: number) {
  return new Date(d.getTime() + n * 60_000);
}

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function slotDate(dayKey: string, hour: number) {
  const [year, month, day] = dayKey.split('-').map(Number);
  return new Date(year, month - 1, day, hour, 0, 0, 0);
}

function toLocalInput(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function hmLocal(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function hmDate(d: Date) {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function orderedSelection(start: Date, current: Date) {
  const first = start.getTime() <= current.getTime() ? start : current;
  const last = start.getTime() <= current.getTime() ? current : start;
  return {
    start: new Date(first),
    // A click gets one 15-minute slot. A real drag ends exactly at
    // the quarter-hour under the pointer, like Google Calendar.
    end: addMinutes(last, first.getTime() === last.getTime() ? 15 : 0),
  };
}

function selectionLabel(selection: { start: Date; end: Date }) {
  const formatDate = (date: Date) => date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const start = `${formatDate(selection.start)} ${hmDate(selection.start)}`;
  const end = `${formatDate(selection.end)} ${hmDate(selection.end)}`;
  return start === end ? start : `${start} – ${end}`;
}

const HOURS = Array.from({ length: 13 }, (_, i) => i + 8);
const QUARTERS = [0, 15, 30, 45] as const;

type Selection = { start: Date; end: Date };
type DragState = { start: Date; current: Date };

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
  const [endsWhen, setEndsWhen] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<DragState | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const calendarRef = useRef<HTMLDivElement>(null);

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

  // Keep tracking a drag even after the pointer leaves the original cell.
  // This makes the interaction work with a mouse and with touch screens.
  useEffect(() => {
    if (!dragging) return;

    const handlePointerMove = (event: PointerEvent) => {
      if (!dragRef.current) return;
      const target = document
        .elementFromPoint(event.clientX, event.clientY)
        ?.closest<HTMLElement>('[data-calendar-cell]');
      if (!target || !calendarRef.current?.contains(target)) return;

      const dayKey = target.dataset.day;
      const hour = Number(target.dataset.hour);
      const minute = Number(target.dataset.minute);
      if (!dayKey || Number.isNaN(hour) || Number.isNaN(minute)) return;

      event.preventDefault();
      const current = slotDate(dayKey, hour);
      current.setMinutes(minute);
      dragRef.current.current = current;
      setSelection(orderedSelection(dragRef.current.start, current));
    };

    const finishDrag = () => {
      const active = dragRef.current;
      if (!active) return;

      const next = orderedSelection(active.start, active.current);
      setSelection(next);
      setWhen(toLocalInput(next.start));
      setEndsWhen(toLocalInput(next.end));
      dragRef.current = null;
      setDragging(false);

      // On a phone the form is above the week grid. Bring it into view after
      // the gesture so the selected time can be completed immediately.
      window.setTimeout(() => {
        formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 40);
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: false });
    window.addEventListener('pointerup', finishDrag);
    window.addEventListener('pointercancel', finishDrag);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', finishDrag);
      window.removeEventListener('pointercancel', finishDrag);
    };
  }, [dragging]);

  const filteredClients = query.trim()
    ? clients.filter(c => `${c.name} ${c.email}`.toLowerCase().includes(query.trim().toLowerCase()))
    : clients;

  const eventsOn = (day: Date) => {
    const key = ymd(day);
    return items.filter(a => ymd(new Date(a.startsAt)) === key);
  };

  const isSelected = (day: Date, hour: number, minute: number) => {
    if (!selection) return false;
    const slotStart = slotDate(ymd(day), hour);
    slotStart.setMinutes(minute);
    const slotEnd = addMinutes(slotStart, 15);
    return selection.start < slotEnd && selection.end > slotStart;
  };

  const handleCellPointerDown = (event: React.PointerEvent<HTMLDivElement>, day: Date, hour: number, minute: number) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest('button, [data-calendar-event]')) return;

    event.preventDefault();
    const start = slotDate(ymd(day), hour);
    start.setMinutes(minute);
    dragRef.current = { start, current: start };
    const next = orderedSelection(start, start);
    setSelection(next);
    setWhen(toLocalInput(next.start));
    setEndsWhen(toLocalInput(next.end));
    setDragging(true);
  };

  return (
    <div className="min-w-0 space-y-4">
      <Card title="New reminder" subtitle="Pick a client and a time — click their name later to open the profile">
        <form
          ref={formRef}
          className="p-5 grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3"
          onSubmit={async e => {
            e.preventDefault();
            if (!clientId || !when || !endsWhen || saving) return;
            setSaving(true);
            try {
              const start = new Date(when);
              const end = new Date(endsWhen);
              if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
                onNotify('The end time must be after the start time.');
                return;
              }
              await apiCreateAppointment({
                clientId: Number(clientId),
                startsAt: start.toISOString(),
                endsAt: end.toISOString(),
                notes,
              });
              setNotes('');
              setWhen('');
              setEndsWhen('');
              setSelection(null);
              await load();
              onNotify('Reminder saved.');
            } catch (err) {
              onNotify(err instanceof Error ? err.message : 'Could not save');
            } finally {
              setSaving(false);
            }
          }}
        >
          {selection && (
            <div className="md:col-span-2 flex items-start justify-between gap-3 rounded-xl border border-[#B08B48]/30 bg-[#B08B48]/10 px-3.5 py-2.5">
              <div className="min-w-0">
                <div className="text-[11px] font-bold uppercase tracking-wide text-[#B08B48]">Selected time</div>
                <div className="text-[13px] font-semibold text-[#1C412C] break-words">{selectionLabel(selection)}</div>
                <div className="text-[11px] text-[#213532]/65 mt-0.5">Choose a client below, then save the reminder.</div>
              </div>
              <button
                type="button"
                className="shrink-0 p-1 text-[#213532]/50 hover:text-[#1C412C] cursor-pointer"
                onClick={() => { setSelection(null); setWhen(''); setEndsWhen(''); }}
                aria-label="Clear selected time"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          <div>
            <label className="text-[11px] font-bold uppercase text-[#213532]/70">Find client</label>
            <Input className="w-full mt-1" placeholder="Name or email…" value={query} onChange={e => setQuery(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <label className="text-[11px] font-bold uppercase text-[#213532]/70">Date & time</label>
            <div className="mt-1 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1.5 max-[480px]:grid-cols-1">
              <div className="min-w-0">
                <span className="hidden max-[480px]:block mb-1 text-[10px] font-semibold uppercase text-[#213532]/55">From</span>
                <Input
                  className="w-full"
                  type="datetime-local"
                  value={when}
                  onChange={e => {
                    setWhen(e.target.value);
                    setSelection(null);
                  }}
                />
              </div>
              <span className="text-[12px] font-semibold text-[#213532]/40 max-[480px]:hidden">–</span>
              <div className="min-w-0">
                <span className="hidden max-[480px]:block mb-1 text-[10px] font-semibold uppercase text-[#213532]/55">To</span>
                <Input
                  className="w-full"
                  type="datetime-local"
                  value={endsWhen}
                  onChange={e => {
                    setEndsWhen(e.target.value);
                    setSelection(null);
                  }}
                />
              </div>
            </div>
          </div>
          <div>
            <label className="text-[11px] font-bold uppercase text-[#213532]/70">Client</label>
            <Select className="w-full mt-1" value={clientId} onChange={e => setClientId(e.target.value)}>
              <option value="">Select client…</option>
              {filteredClients.map(c => (
                <option key={c.id} value={c.id}>{c.name} · {c.email}</option>
              ))}
            </Select>
          </div>
          <div>
            <label className="text-[11px] font-bold uppercase text-[#213532]/70">Note</label>
            <Input className="w-full mt-1" placeholder="Call, KYC, deposit…" value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
          <div className="md:col-span-2 flex flex-wrap items-center gap-3">
            <Btn variant="gold" type="submit" disabled={saving || !clientId || !when || !endsWhen}>Save reminder</Btn>
            <span className="text-[11px] text-[#213532]/55">Tip: drag across the week below to choose the time.</span>
          </div>
        </form>
      </Card>

      <Card
        title="Week"
        subtitle={`${days[0].toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} – ${days[6].toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`}
        actions={
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            <Btn size="sm" variant="ghost" icon={ChevronLeft} onClick={() => setWeekAnchor(d => addDays(d, -7))}>Prev</Btn>
            <Btn size="sm" variant="ghost" onClick={() => setWeekAnchor(startOfWeek(new Date()))}>Today</Btn>
            <Btn size="sm" variant="ghost" icon={ChevronRight} onClick={() => setWeekAnchor(d => addDays(d, 7))}>Next</Btn>
          </div>
        }
      >
        <div className="px-5 pt-4 text-[11px] text-[#213532]/60">
          Click a time or drag over several slots to prepare a reminder.
        </div>
        <div className="max-w-full overflow-x-auto overscroll-x-contain px-5 pb-5 pt-3">
          <div ref={calendarRef} className="min-w-[860px] grid grid-cols-8 border-t border-[#E4DECB] select-none">
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
                  const dayKey = ymd(d);
                  const slot = eventsOn(d).filter(a => new Date(a.startsAt).getHours() === h);
                  return (
                    <div
                      key={`${dayKey}-${h}`}
                      className="relative min-h-[80px] border-t border-l border-[#E4DECB] overflow-visible"
                    >
                      {QUARTERS.map(minute => (
                        <div
                          key={`${dayKey}-${h}-${minute}`}
                          data-calendar-cell
                          data-day={dayKey}
                          data-hour={h}
                          data-minute={minute}
                          className={`h-5 px-1 cursor-crosshair transition-colors border-t border-[#E4DECB]/70 ${
                            isSelected(d, h, minute)
                              ? 'bg-[#B08B48]/25 ring-1 ring-inset ring-[#B08B48]/45'
                              : 'hover:bg-[#B08B48]/[.07]'
                          }`}
                          style={{ touchAction: 'none' }}
                          onPointerDown={event => handleCellPointerDown(event, d, h, minute)}
                          aria-label={`Select ${d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} at ${String(h).padStart(2, '0')}:${String(minute).padStart(2, '0')}`}
                        />
                      ))}

                      {slot.map(a => {
                        const startsAt = new Date(a.startsAt);
                        const endsAt = new Date(a.endsAt);
                        const duration = Number.isNaN(endsAt.getTime())
                          ? 30
                          : Math.max(15, (endsAt.getTime() - startsAt.getTime()) / 60_000);
                        const top = (startsAt.getMinutes() / 60) * 80;
                        const height = Math.max(32, (duration / 60) * 80);
                        return (
                          <div
                            key={a.id}
                            data-calendar-event
                            className="pointer-events-none absolute left-1 right-1 z-20 overflow-hidden rounded-lg bg-[#1C412C] px-2 py-1.5 text-[11px] text-[#F5F2E9] shadow-sm"
                            style={{ top: `${top}px`, height: `${height}px`, minHeight: '28px' }}
                          >
                            <button
                              type="button"
                              className="pointer-events-auto font-bold hover:underline text-left cursor-pointer break-words"
                              onClick={() => onOpenClient(a.clientId)}
                            >
                              {a.clientName}
                            </button>
                            <div className="opacity-80">{hmLocal(a.startsAt)} · {a.title}</div>
                            {a.notes && <div className="opacity-70 break-words">{a.notes}</div>}
                            <button
                              type="button"
                              className="pointer-events-auto mt-1 inline-flex items-center gap-1 text-[#F5F2E9]/70 hover:text-rose-300 cursor-pointer"
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
                        );
                      })}
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
