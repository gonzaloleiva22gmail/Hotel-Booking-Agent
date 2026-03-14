import React, { useState, useMemo, useEffect, useCallback } from 'react';
import dayjs, { Dayjs } from 'dayjs';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import { Reservation } from '@/types';
import { fetchReservations } from '@/services/airtable';

dayjs.extend(isSameOrAfter);

// ─── Color palette for reservation bars ────────────────────────────────────
const COLORS = [
  { bar: '#7C3AED', dim: '#5B21B6' }, // violet
  { bar: '#0891B2', dim: '#0E7490' }, // cyan
  { bar: '#059669', dim: '#047857' }, // emerald
  { bar: '#D97706', dim: '#B45309' }, // amber
  { bar: '#DC2626', dim: '#B91C1C' }, // red
  { bar: '#2563EB', dim: '#1D4ED8' }, // blue
  { bar: '#DB2777', dim: '#BE185D' }, // pink
  { bar: '#0D9488', dim: '#0F766E' }, // teal
  { bar: '#EA580C', dim: '#C2410C' }, // orange
  { bar: '#7E22CE', dim: '#6B21A8' }, // purple
];

// ─── Types ──────────────────────────────────────────────────────────────────
interface GridEntry {
  reservation: Reservation;
  isFirst: boolean;
  isLast: boolean;
  color: { bar: string; dim: string };
}

interface TooltipState {
  x: number;
  y: number;
  reservation: Reservation;
  color: string;
}

// ─── Icons ──────────────────────────────────────────────────────────────────
function ChevronLeftIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
  );
}
function ChevronRightIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}
function RefreshIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg
      className={`w-4 h-4 ${spinning ? 'animate-spin' : ''}`}
      fill="none" stroke="currentColor" viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function AvailabilityGrid() {
  const [currentMonth, setCurrentMonth] = useState<Dayjs>(() => dayjs().startOf('month'));
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchReservations();
      setReservations(data);
      setLastRefreshed(dayjs().format('h:mm A'));
    } catch (err: any) {
      setError(err.message || 'Failed to load reservations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ─── Compute grid data ───────────────────────────────────────────────────
  const { rooms, days, grid, stats } = useMemo(() => {
    const roomSet = new Set<string>();
    reservations.forEach(r => { if (r.roomNumber) roomSet.add(r.roomNumber); });
    const rooms = Array.from(roomSet).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
    );

    const daysInMonth = currentMonth.daysInMonth();
    const days: Dayjs[] = Array.from({ length: daysInMonth }, (_, i) =>
      currentMonth.date(i + 1)
    );

    const colorMap = new Map<string, { bar: string; dim: string }>();
    let colorIdx = 0;

    const grid: Record<string, Record<string, GridEntry | null>> = {};
    for (const room of rooms) {
      grid[room] = {};
      for (const day of days) {
        grid[room][day.format('YYYY-MM-DD')] = null;
      }
    }

    for (const res of reservations) {
      if (!colorMap.has(res.id)) {
        colorMap.set(res.id, COLORS[colorIdx % COLORS.length]);
        colorIdx++;
      }
      const color = colorMap.get(res.id)!;
      const checkIn = dayjs(res.checkIn);
      const checkOut = dayjs(res.checkOut);
      if (!checkIn.isValid() || !checkOut.isValid()) continue;

      for (const day of days) {
        const occupied =
          (day.isSame(checkIn, 'day') || day.isAfter(checkIn, 'day')) &&
          day.isBefore(checkOut, 'day');

        if (occupied && grid[res.roomNumber] !== undefined) {
          const key = day.format('YYYY-MM-DD');
          const nextDay = day.add(1, 'day');
          grid[res.roomNumber][key] = {
            reservation: res,
            isFirst: day.isSame(checkIn, 'day'),
            isLast: nextDay.isSame(checkOut, 'day') || nextDay.isAfter(checkOut, 'day'),
            color,
          };
        }
      }
    }

    const today = dayjs();
    const todayKey = today.format('YYYY-MM-DD');
    let occupiedToday = 0;
    if (days.some(d => d.format('YYYY-MM-DD') === todayKey)) {
      for (const room of rooms) {
        if (grid[room]?.[todayKey]) occupiedToday++;
      }
    }

    return { rooms, days, grid, stats: { total: reservations.length, rooms: rooms.length, occupiedToday } };
  }, [reservations, currentMonth]);

  const today = dayjs();
  const isCurrentMonth = currentMonth.isSame(today, 'month');

  // ─── Skeleton loader ─────────────────────────────────────────────────────
  if (loading && reservations.length === 0) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-14 h-14 rounded-full border-4 border-violet-500 border-t-transparent animate-spin mx-auto" />
          <p className="text-slate-400 text-sm">Loading reservation data…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">

      {/* ── HEADER ─────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur border-b border-slate-800 shadow-xl">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">

            {/* Brand */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-lg shadow-lg">
                🏨
              </div>
              <div>
                <h1 className="text-base font-bold text-white leading-tight">Availability Board</h1>
                <p className="text-xs text-slate-500 leading-tight">
                  {lastRefreshed ? `Updated ${lastRefreshed}` : 'Hotel PMS — Room Occupancy View'}
                </p>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Month nav */}
              <div className="flex items-center gap-1 bg-slate-800 rounded-xl p-1">
                <button
                  onClick={() => setCurrentMonth(m => m.subtract(1, 'month'))}
                  className="w-8 h-8 rounded-lg hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
                >
                  <ChevronLeftIcon />
                </button>
                <div className="px-3 min-w-[130px] text-center">
                  <span className="text-sm font-semibold text-white">
                    {currentMonth.format('MMMM YYYY')}
                  </span>
                </div>
                <button
                  onClick={() => setCurrentMonth(m => m.add(1, 'month'))}
                  className="w-8 h-8 rounded-lg hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
                >
                  <ChevronRightIcon />
                </button>
              </div>

              {/* Today btn */}
              {!isCurrentMonth && (
                <button
                  onClick={() => setCurrentMonth(dayjs().startOf('month'))}
                  className="px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-300 transition-colors"
                >
                  This Month
                </button>
              )}

              {/* Refresh */}
              <button
                onClick={load}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-1.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-60 rounded-xl text-sm font-medium transition-colors shadow-lg shadow-violet-500/20"
              >
                <RefreshIcon spinning={loading} />
                Refresh
              </button>
            </div>
          </div>

          {/* Error banner */}
          {error && (
            <div className="mt-2 px-4 py-2 bg-red-900/30 border border-red-800 rounded-lg text-red-400 text-xs flex items-center gap-2">
              <span>⚠</span>
              <span>{error}</span>
            </div>
          )}
        </div>
      </header>

      {/* ── STATS BAR ──────────────────────────────────────────────────── */}
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 pt-4">
        <div className="grid grid-cols-3 gap-3 mb-4">
          {[
            { label: 'Total Reservations', value: stats.total, icon: '📋' },
            { label: 'Rooms Tracked', value: stats.rooms, icon: '🚪' },
            { label: 'Occupied Today', value: stats.occupiedToday, icon: '👤' },
          ].map(s => (
            <div key={s.label} className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex items-center gap-3">
              <span className="text-xl">{s.icon}</span>
              <div>
                <div className="text-xl font-bold text-white">{s.value}</div>
                <div className="text-xs text-slate-500">{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── GRID ───────────────────────────────────────────────────────── */}
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 pb-8">
        {rooms.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 bg-slate-900 border border-slate-800 rounded-2xl text-slate-500">
            <div className="text-5xl mb-3">🏨</div>
            <p className="text-base font-medium">No reservations found</p>
            <p className="text-sm mt-1">
              {error ? 'Check your API key configuration.' : 'Reservations for this month will appear here.'}
            </p>
          </div>
        ) : (
          <div className="rounded-2xl overflow-hidden border border-slate-800 shadow-2xl">
            <div
              className="overflow-auto"
              style={{ maxHeight: 'calc(100vh - 260px)' }}
            >
              <table className="border-collapse text-xs" style={{ minWidth: `${100 + rooms.length * 110}px` }}>

                {/* ── ROOM HEADERS ─────────────────────────────── */}
                <thead>
                  <tr>
                    {/* Corner cell */}
                    <th
                      className="sticky left-0 top-0 z-30 bg-slate-900 border-b border-r border-slate-800 p-3 text-left text-slate-500 font-normal"
                      style={{ minWidth: 100 }}
                    >
                      {currentMonth.format('MMM YYYY')}
                    </th>
                    {rooms.map((room) => (
                      <th
                        key={room}
                        className="sticky top-0 z-20 bg-slate-900 border-b border-r border-slate-800 p-2 text-center font-semibold text-slate-200 whitespace-nowrap"
                        style={{ minWidth: 110 }}
                      >
                        <div className="text-xs font-bold">Room {room}</div>
                      </th>
                    ))}
                  </tr>
                </thead>

                {/* ── DAY ROWS ────────────────────────────────── */}
                <tbody>
                  {days.map((day) => {
                    const dateKey = day.format('YYYY-MM-DD');
                    const isToday = isCurrentMonth && day.isSame(today, 'day');
                    const isWeekend = day.day() === 0 || day.day() === 6;

                    return (
                      <tr key={dateKey}>
                        {/* Date label */}
                        <td
                          className={`sticky left-0 z-10 border-b border-r border-slate-800/60 p-2 whitespace-nowrap ${
                            isToday
                              ? 'bg-violet-950/90'
                              : isWeekend
                                ? 'bg-slate-900/80'
                                : 'bg-slate-950'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-slate-600 w-7 text-right shrink-0">{day.format('ddd')}</span>
                            <span className={`font-bold w-5 text-center ${isToday ? 'text-violet-300' : isWeekend ? 'text-slate-400' : 'text-slate-300'}`}>
                              {day.format('D')}
                            </span>
                            {isToday && (
                              <span className="text-[10px] bg-violet-500 text-white rounded-md px-1.5 py-0.5 font-semibold leading-none">
                                Today
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Room cells */}
                        {rooms.map((room) => {
                          const entry = grid[room]?.[dateKey] ?? null;

                          return (
                            <td
                              key={room}
                              className={`border-b border-r border-slate-800/40 relative ${
                                isToday
                                  ? 'bg-violet-950/10'
                                  : isWeekend
                                    ? 'bg-slate-900/20'
                                    : 'bg-slate-950'
                              }`}
                              style={{ height: 36 }}
                              onMouseEnter={entry ? (e) => {
                                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                setTooltip({
                                  x: rect.left + rect.width / 2,
                                  y: rect.top,
                                  reservation: entry.reservation,
                                  color: entry.color.bar,
                                });
                              } : undefined}
                              onMouseLeave={() => setTooltip(null)}
                            >
                              {entry && (
                                <div
                                  className="absolute inset-x-0.5 flex items-center px-2 overflow-hidden cursor-pointer transition-opacity hover:opacity-90"
                                  style={{
                                    backgroundColor: entry.color.bar,
                                    top: entry.isFirst ? 3 : 0,
                                    bottom: entry.isLast ? 3 : 0,
                                    borderRadius: entry.isFirst && entry.isLast
                                      ? 6
                                      : entry.isFirst
                                        ? '6px 6px 0 0'
                                        : entry.isLast
                                          ? '0 0 6px 6px'
                                          : 0,
                                  }}
                                >
                                  {entry.isFirst && (
                                    <span className="text-white text-[11px] font-semibold truncate leading-none drop-shadow-sm">
                                      {entry.reservation.guestName}
                                    </span>
                                  )}
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* ── LEGEND ─────────────────────────────────────── */}
            <div className="bg-slate-900 border-t border-slate-800 px-4 py-2 flex items-center gap-6 text-xs text-slate-500">
              <div className="flex items-center gap-1.5">
                <div className="w-8 h-3 rounded-full bg-violet-500" />
                <span>Occupied</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded bg-slate-800 border border-slate-700" />
                <span>Available</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded bg-violet-950/20 border border-violet-800/20" />
                <span>Today</span>
              </div>
              <span className="ml-auto text-slate-600">Hover on a block to see guest details</span>
            </div>
          </div>
        )}
      </div>

      {/* ── TOOLTIP (fixed, follows cell) ──────────────────────────────── */}
      {tooltip && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{
            left: tooltip.x,
            top: tooltip.y - 12,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <div className="bg-slate-800/95 backdrop-blur-sm border border-slate-600 rounded-2xl shadow-2xl p-4 w-56">
            {/* Color accent + name */}
            <div className="flex items-center gap-2 mb-3">
              <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: tooltip.color }} />
              <span className="font-bold text-white text-sm truncate">{tooltip.reservation.guestName}</span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Room</span>
                <span className="text-white font-medium">
                  {tooltip.reservation.roomNumber}
                  {tooltip.reservation.roomType && (
                    <span className="text-slate-400 ml-1">({tooltip.reservation.roomType})</span>
                  )}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Check-in</span>
                <span className="text-emerald-400 font-medium">
                  {dayjs(tooltip.reservation.checkIn).format('MMM D, YYYY')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Check-out</span>
                <span className="text-rose-400 font-medium">
                  {dayjs(tooltip.reservation.checkOut).format('MMM D, YYYY')}
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t border-slate-700 mt-1">
                <span className="text-slate-500">Duration</span>
                <span className="text-white font-semibold">
                  {dayjs(tooltip.reservation.checkOut).diff(dayjs(tooltip.reservation.checkIn), 'day')} nights
                </span>
              </div>
            </div>

            {/* Arrow */}
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full">
              <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-l-transparent border-r-transparent border-t-slate-600" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
