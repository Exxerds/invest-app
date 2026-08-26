import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { ApiAppointment, ApiUser } from '../../api';
import {
  apiAppointments,
  apiCreateAppointment,
  apiDeleteAppointment,
  apiUpdateAppointment,
} from '../../api';
import { Card, Btn, Input, Select } from './ui';
import { ChevronLeft, ChevronRight, Pencil, Trash2, X } from 'lucide-react';

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

function slotDate(dayKey: string, hour: number, minute = 0) {
  const [year, month, day] = dayKey.split('-').map(Number);
  return new Date(year, month - 1, day, hour, minute, 0, 0);
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

function fullDate(d: Date) {
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function dateTimeRange(start: Date, end: Date) {
  const first = `${fullDate(start)} ${hmDate(start)}`;
  const second = `${fullDate(end)} ${hmDate(end)}`;
  return first === second ? first : `${first} – ${second}`;
}

function orderedSelection(start: Date, current: Date) {
  const first = start.getTime() <= current.getTime() ? start : current;
  const last = start.getTime() <= current.getTime() ? current : start;
  return {
    start: new Date(first),
    end: addMinutes(last, first.getTime() === last.getTime() ? 15 : 0),
  };
}

const HOURS = Array.from({ length: 16 }, (_, i) => i + 8);
const QUARTERS = [0, 15, 30, 45] as const;
const HOUR_HEIGHT = 80;
const CALENDAR_START_HOUR = 8;
const CALENDAR_END_HOUR = 24;
const EVENT_PALETTE = [
  { background: '#1C412C', border: '#B08B48' },
  { background: '#23536A', border: '#6EC4D9' },
  { background: '#684158', border: '#D99AB9' },
  { background: '#705331', border: '#E0B56D' },
  { background: '#35655A', border: '#8FD3B5' },
  { background: '#4E4774', border: '#B9ADF0' },
];

type Selection = { start: Date; end: Date };
type DragState = { start: Date; current: Date };
type EventSegment = {
  appointment: ApiAppointment;
  start: Date;
  end: Date;
  column: number;
  totalColumns: number;
};

function eventSegmentsForDay(day: Date, events: ApiAppointment[]): EventSegment[] {
  const dayKey = ymd(day);
  const viewStart = slotDate(dayKey, CALENDAR_START_HOUR);
  const viewEnd = slotDate(dayKey, CALENDAR_END_HOUR);
  const candidates = events
    .map(appointment => {
      const rawStart = new Date(appointment.startsAt);
      const rawEnd = new Date(appointment.endsAt);
      if (Number.isNaN(rawStart.getTime())) return null;
      const safeEnd = Number.isNaN(rawEnd.getTime()) || rawEnd <= rawStart
        ? addMinutes(rawStart, 30)
        : rawEnd;
      const start = rawStart < viewStart ? viewStart : rawStart;
      const end = safeEnd > viewEnd ? viewEnd : safeEnd;
      if (end <= start) return null;
      return { appointment, start, end };
    })
    .filter((x): x is { appointment: ApiAppointment; start: Date; end: Date } => x !== null)
    .sort((a, b) => a.start.getTime() - b.start.getTime() || b.end.getTime() - a.end.getTime());

  const columnEnds: Date[] = [];
  const placed = candidates.map(candidate => {
    let column = columnEnds.findIndex(end => end.getTime() <= candidate.start.getTime());
    if (column === -1) column = columnEnds.length;
    columnEnds[column] = candidate.end;
    return { ...candidate, column };
  });

  const totalColumns = Math.max(columnEnds.length, 1);
  return placed.map(segment => ({ ...segment, totalColumns }));
}

function slotFromPoint(event: { clientX: number; clientY: number }, root: HTMLDivElement | null) {
  if (!root) return null;
  const hit = document.elementFromPoint(event.clientX, event.clientY);
  const quarter = hit?.closest<HTMLElement>('[data-calendar-cell]');
  const hourCell = hit?.closest<HTMLElement>('[data-calendar-hour]');
  const target = quarter || hourCell;
  if (!target || !root.contains(target)) return null;

  const dayKey = target.dataset.day;
  const hour = Number(target.dataset.hour);
  if (!dayKey || Number.isNaN(hour)) return null;

  if (quarter) {
    const minute = Number(quarter.dataset.minute);
    if (Number.isNaN(minute)) return null;
    return slotDate(dayKey, hour, minute);
  }

  const rect = target.getBoundingClientRect();
  const ratio = Math.max(0, Math.min(0.999, (event.clientY - rect.top) / Math.max(rect.height, 1)));
  const minute = Math.min(45, Math.floor(ratio * 4) * 15);
  return slotDate(dayKey, hour, minute);
}

export const CrmCalendarPanel: React.FC<{
  users: ApiUser[];
  onOpenClient: (userId: number) => void;
  onNotify: (m: string) => void;
}> = ({ users, onOpenClient, onNotify }) => {
  const clients = users.filter(u => u.role === 'CLIENT');
  const [weekAnchor, setWeekAnchor] = useState(() => startOfWeek(new Date()));
  const [items, setItems] = useState<ApiAppointment[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [query, setQuery] = useState('');
  const [clientId, setClientId] = useState('');
  const [when, setWhen] = useState('');
  const [endsWhen, setEndsWhen] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [dragging, setDragging] = useState(false);
  const [eventsOpen, setEventsOpen] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [editingEvent, setEditingEvent] = useState<ApiAppointment | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editStart, setEditStart] = useState('');
  const [editEnd, setEditEnd] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const dragRef = useRef<DragState | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const calendarRef = useRef<HTMLDivElement>(null);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekAnchor, i)), [weekAnchor]);

  const load = async () => {
    try {
      const r = await apiAppointments();
      setItems(r.appointments);
      setNow(Date.now());
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Could not load calendar');
    }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const visibleItems = useMemo(
    () => items.filter(a => {
      const end = new Date(a.endsAt).getTime();
      const start = new Date(a.startsAt).getTime();
      return (Number.isNaN(end) ? start : end) > now;
    }),
    [items, now],
  );

  const segmentsByDay = useMemo(() => {
    const map = new Map<string, EventSegment[]>();
    days.forEach(day => map.set(ymd(day), eventSegmentsForDay(day, visibleItems)));
    return map;
  }, [days, visibleItems]);

  const filteredClients = query.trim()
    ? clients.filter(c => `${c.name} ${c.email}`.toLowerCase().includes(query.trim().toLowerCase()))
    : clients;

  // Track a blank-grid drag globally so the selection remains accurate when
  // the pointer crosses several quarter-hour cells.
  useEffect(() => {
    if (!dragging) return;

    const handlePointerMove = (event: PointerEvent) => {
      if (!dragRef.current) return;
      const current = slotFromPoint(event, calendarRef.current);
      if (!current) return;
      event.preventDefault();
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
      window.setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 40);
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

  const isSelected = (day: Date, hour: number, minute: number) => {
    if (!selection) return false;
    const slotStart = slotDate(ymd(day), hour, minute);
    return selection.start < addMinutes(slotStart, 15) && selection.end > slotStart;
  };

  const startBlankDrag = (event: React.PointerEvent<HTMLDivElement>, day: Date, hour: number, minute: number) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if ((event.target as HTMLElement).closest('[data-calendar-event], button')) return;
    event.preventDefault();
    const start = slotDate(ymd(day), hour, minute);
    dragRef.current = { start, current: start };
    const next = orderedSelection(start, start);
    setSelection(next);
    setWhen(toLocalInput(next.start));
    setEndsWhen(toLocalInput(next.end));
    setDragging(true);
    setSelectedEventId(null);
  };

  const openEdit = (appointment: ApiAppointment) => {
    setEditingEvent(appointment);
    setEditTitle(appointment.title || '');
    setEditStart(toLocalInput(new Date(appointment.startsAt)));
    setEditEnd(toLocalInput(new Date(appointment.endsAt)));
    setEditNotes(appointment.notes || '');
    setSelectedEventId(appointment.id);
  };

  const jumpToEvent = (appointment: ApiAppointment) => {
    setWeekAnchor(startOfWeek(new Date(appointment.startsAt)));
    setSelectedEventId(appointment.id);
    setEventsOpen(false);
    window.setTimeout(() => {
      document.querySelector(`[data-calendar-event-id="${appointment.id}"]`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    }, 120);
  };

  const removeEvent = async (appointment: ApiAppointment) => {
    try {
      await apiDeleteAppointment(appointment.id);
      if (selectedEventId === appointment.id) setSelectedEventId(null);
      if (editingEvent?.id === appointment.id) setEditingEvent(null);
      await load();
      onNotify('Reminder removed.');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Could not delete');
    }
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
                <div className="text-[13px] font-semibold text-[#1C412C] break-words">{dateTimeRange(selection.start, selection.end)}</div>
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
          <div className="flex items-end">
            <button
              type="button"
              className="w-full mt-1 inline-flex items-center justify-between gap-2 px-3.5 py-2 rounded-xl border border-[#E4DECB] bg-[#1C412C]/[.06] text-[13px] font-semibold text-[#213532] hover:bg-[#1C412C]/[.12] cursor-pointer"
              onClick={() => setEventsOpen(open => !open)}
            >
              <span>All events</span>
              <span className="text-[11px] text-[#B08B48]">{visibleItems.length}</span>
            </button>
          </div>

          {eventsOpen && (
            <div className="md:col-span-2 max-h-64 overflow-y-auto rounded-xl border border-[#E4DECB] divide-y divide-[#E4DECB] bg-white">
              {visibleItems.length === 0 ? (
                <div className="px-3.5 py-3 text-[12px] text-[#213532]/60">No upcoming reminders.</div>
              ) : visibleItems.map(appointment => (
                <button
                  key={appointment.id}
                  type="button"
                  className={`w-full flex items-start justify-between gap-3 px-3.5 py-2.5 text-left hover:bg-[#F2EEDF] cursor-pointer ${selectedEventId === appointment.id ? 'bg-[#B08B48]/10' : ''}`}
                  onClick={() => jumpToEvent(appointment)}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[12.5px] font-semibold text-[#1C412C]">{appointment.clientName}</span>
                    <span className="block break-words text-[11px] text-[#213532]/70">{dateTimeRange(new Date(appointment.startsAt), new Date(appointment.endsAt))}</span>
                  </span>
                  <span className="shrink-0 text-[10px] text-[#B08B48]">Open</span>
                </button>
              ))}
            </div>
          )}

          <div className="md:col-span-2">
            <label className="text-[11px] font-bold uppercase text-[#213532]/70">Date & time</label>
            <div className="mt-1 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1.5 max-[480px]:grid-cols-1">
              <div className="min-w-0">
                <span className="hidden max-[480px]:block mb-1 text-[10px] font-semibold uppercase text-[#213532]/55">From</span>
                <Input className="w-full" type="datetime-local" value={when} onChange={e => { setWhen(e.target.value); setSelection(null); }} />
              </div>
              <span className="text-[12px] font-semibold text-[#213532]/40 max-[480px]:hidden">–</span>
              <div className="min-w-0">
                <span className="hidden max-[480px]:block mb-1 text-[10px] font-semibold uppercase text-[#213532]/55">To</span>
                <Input className="w-full" type="datetime-local" value={endsWhen} onChange={e => { setEndsWhen(e.target.value); setSelection(null); }} />
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
            <span className="text-[11px] text-[#213532]/55">Click or drag a 15-minute slot in the week below.</span>
          </div>

        </form>
          {editingEvent && (
            <div className="md:col-span-2 rounded-xl border border-[#1C412C]/15 bg-[#F5F2E9] p-3.5">
              <div className="flex items-center justify-between gap-3 mb-2.5">
                <div className="text-[11px] font-bold uppercase tracking-wide text-[#1C412C]">Edit reminder</div>
                <button type="button" className="p-1 text-[#213532]/50 hover:text-[#1C412C] cursor-pointer" onClick={() => setEditingEvent(null)} aria-label="Close edit reminder">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <form
                className="grid grid-cols-1 md:grid-cols-2 gap-2.5"
                onSubmit={async e => {
                  e.preventDefault();
                  if (editSaving) return;
                  const start = new Date(editStart);
                  const end = new Date(editEnd);
                  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
                    onNotify('The end time must be after the start time.');
                    return;
                  }
                  setEditSaving(true);
                  try {
                    await apiUpdateAppointment(editingEvent.id, {
                      title: editTitle,
                      startsAt: start.toISOString(),
                      endsAt: end.toISOString(),
                      notes: editNotes,
                    });
                    setEditingEvent(null);
                    await load();
                    onNotify('Reminder updated.');
                  } catch (err) {
                    onNotify(err instanceof Error ? err.message : 'Could not update reminder');
                  } finally {
                    setEditSaving(false);
                  }
                }}
              >
                <Input className="w-full" placeholder="Title" value={editTitle} onChange={e => setEditTitle(e.target.value)} />
                <Input className="w-full" placeholder="Note" value={editNotes} onChange={e => setEditNotes(e.target.value)} />
                <Input className="w-full" type="datetime-local" value={editStart} onChange={e => setEditStart(e.target.value)} />
                <Input className="w-full" type="datetime-local" value={editEnd} onChange={e => setEditEnd(e.target.value)} />
                <div className="md:col-span-2 flex flex-wrap items-center gap-2">
                  <Btn type="submit" variant="gold" disabled={editSaving}>Save changes</Btn>
                  <Btn type="button" variant="ghost" onClick={() => removeEvent(editingEvent)}>Delete</Btn>
                </div>
              </form>
            </div>
          )}
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
          Click a time or drag across the 15-minute lines to prepare a reminder. Click an existing reminder to select it.
        </div>
        <div className="max-w-full overflow-x-auto overscroll-x-contain px-5 pb-5 pt-3">
          <div ref={calendarRef} className="min-w-[860px] grid grid-cols-8 border-t border-[#E4DECB] select-none">
            <div className="p-2 text-[10px] font-bold uppercase text-[#213532]/40">Time</div>
            {days.map(d => (
              <div key={ymd(d)} className={`p-2 text-center border-l border-[#E4DECB] ${ymd(d) === ymd(new Date()) ? 'bg-[#B08B48]/10' : ''}`}>
                <div className="text-[10px] font-bold uppercase text-[#213532]/50">{d.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                <div className="text-[16px] font-extrabold text-[#1C412C]">{d.getDate()}</div>
              </div>
            ))}
            {HOURS.map(h => (
              <React.Fragment key={h}>
                <div className="min-h-[80px] px-2 py-3 text-[11px] text-[#213532]/50 border-t border-[#E4DECB]">
                  {String(h).padStart(2, '0')}:00
                </div>
                {days.map(d => {
                  const dayKey = ymd(d);
                  const segments = (segmentsByDay.get(dayKey) || []).filter(segment => segment.start.getHours() === h);
                  return (
                    <div
                      key={`${dayKey}-${h}`}
                      data-calendar-hour
                      data-day={dayKey}
                      data-hour={h}
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
                            isSelected(d, h, minute) ? 'bg-[#B08B48]/25 ring-1 ring-inset ring-[#B08B48]/45' : 'hover:bg-[#B08B48]/[.07]'
                          }`}
                          style={{ touchAction: 'none' }}
                          onPointerDown={event => startBlankDrag(event, d, h, minute)}
                          aria-label={`Select ${d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} at ${String(h).padStart(2, '0')}:${String(minute).padStart(2, '0')}`}
                        />
                      ))}

                      {segments.map(segment => {
                        const appointment = segment.appointment;
                        const selected = selectedEventId === appointment.id;
                        const dimmed = selectedEventId !== null && !selected;
                        // The event is rendered inside its starting hour row,
                        // so the vertical offset must be measured from that row,
                        // not from 08:00. Otherwise a 09:30 event appears at 10:30.
                        const top = ((segment.start.getTime() - slotDate(dayKey, h).getTime()) / 3_600_000) * HOUR_HEIGHT;
                        const height = Math.max(40, ((segment.end.getTime() - segment.start.getTime()) / 3_600_000) * HOUR_HEIGHT);
                        const width = 100 / segment.totalColumns;
                        const color = EVENT_PALETTE[(appointment.id - 1) % EVENT_PALETTE.length];
                        return (
                          <div
                            key={`${appointment.id}-${dayKey}`}
                            data-calendar-event
                            data-calendar-event-id={appointment.id}
                            className={`absolute z-20 pointer-events-auto overflow-hidden rounded-lg px-2 py-1.5 text-[11px] text-[#F5F2E9] shadow-sm transition-opacity cursor-pointer ${
                              selected ? 'z-40 ring-2 ring-[#B08B48] ring-offset-1' : dimmed ? 'opacity-35' : ''
                            }`}
                            style={{
                              top: `${top}px`,
                              height: `${height}px`,
                              left: `calc(${segment.column * width}% + 4px)`,
                              width: `calc(${width}% - 6px)`,
                              minHeight: '40px',
                              backgroundColor: color.background,
                              border: `1px solid ${color.border}`,
                            }}
                            onClick={() => setSelectedEventId(appointment.id)}
                          >
                            <div className="flex items-start justify-between gap-1">
                              <button
                                type="button"
                                className="min-w-0 flex-1 pointer-events-auto text-left font-bold hover:underline cursor-pointer break-words"
                                onPointerDown={event => event.stopPropagation()}
                                onClick={() => { setSelectedEventId(appointment.id); onOpenClient(appointment.clientId); }}
                              >
                                {appointment.clientName}
                              </button>
                              <span className="shrink-0 flex items-center gap-0.5">
                                <button
                                  type="button"
                                  title="Edit reminder"
                                  aria-label="Edit reminder"
                                  className="pointer-events-auto rounded p-0.5 text-[#F5F2E9]/75 hover:bg-white/15 hover:text-white cursor-pointer"
                                  onPointerDown={event => event.stopPropagation()}
                                  onClick={() => openEdit(appointment)}
                                >
                                  <Pencil className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  title="Delete reminder"
                                  aria-label="Delete reminder"
                                  className="pointer-events-auto rounded p-0.5 text-[#F5F2E9]/75 hover:bg-rose-500/30 hover:text-white cursor-pointer"
                                  onPointerDown={event => event.stopPropagation()}
                                  onClick={() => removeEvent(appointment)}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </span>
                            </div>
                            <div className="opacity-80">{hmLocal(appointment.startsAt)} · {appointment.title}</div>
                            {appointment.notes && <div className="opacity-70 break-words">{appointment.notes}</div>}
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
