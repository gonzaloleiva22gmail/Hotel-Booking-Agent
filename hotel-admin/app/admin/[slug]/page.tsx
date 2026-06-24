'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { ModalShell } from './crud-shared'
import { Reservation, Room } from '@/lib/types'

type GridReservation = Reservation & { room?: Room | null }

export default function OccupancyPage() {
  const { slug } = useParams<{ slug: string }>()
  const [rooms, setRooms] = useState<Room[]>([])
  const [reservations, setReservations] = useState<GridReservation[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedReservation, setSelectedReservation] = useState<GridReservation | null>(null)
  const [month, setMonth] = useState(() => {
    const now = new Date()
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  })

  useEffect(() => {
    async function load() {
      setLoading(true)
      const monthKey = month.toISOString().slice(0, 7)
      const [roomsData, reservationData] = await Promise.all([
        fetch(`/api/hotels/${slug}/rooms`).then((r) => r.json()),
        fetch(`/api/hotels/${slug}/reservations?month=${monthKey}`).then((r) => r.json()),
      ])

      setRooms(Array.isArray(roomsData) ? roomsData : [])
      setReservations(Array.isArray(reservationData) ? reservationData : [])
      setLoading(false)
    }

    load()
  }, [slug, month])

  const days = useMemo(() => getDaysInMonth(month), [month])
  const monthLabel = new Intl.DateTimeFormat('es-PE', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(month)
  const todayIso = new Date().toISOString().slice(0, 10)
  const occupiedToday = rooms.filter((room) =>
    reservations.some((reservation) => isReservationActiveOnDay(reservation, room.id, todayIso))
  ).length

  return (
    <div className="page-shell">
      <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <span className="eyebrow">Vista principal</span>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950">
            Ocupacion
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Un solo calendario compartido para revisar entradas, salidas y bloques de estadia
            por habitacion.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setMonth(shiftMonth(month, -1))} className="button-secondary">
            Mes anterior
          </button>
          <div className="rounded-2xl bg-white/85 px-4 py-2 text-sm font-medium capitalize text-slate-700">
            {monthLabel}
          </div>
          <button onClick={() => setMonth(shiftMonth(month, 1))} className="button-secondary">
            Mes siguiente
          </button>
        </div>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <MetricCard label="Habitaciones activas" value={`${rooms.length}`} />
        <MetricCard label="Ocupadas hoy" value={`${occupiedToday}`} />
        <MetricCard label="Reservas del mes" value={`${reservations.length}`} />
      </div>

      <div className="mb-6 flex flex-wrap gap-3 text-xs font-medium text-slate-500">
        <LegendSwatch label="Libre" className="border border-dashed border-[rgba(36,87,255,0.16)] bg-white" />
        <LegendSwatch label="Ocupada" className="bg-[rgba(36,87,255,0.12)]" />
        <LegendSwatch label="Cancelada" className="bg-[rgba(239,68,68,0.12)]" />
      </div>

      {loading ? (
        <div className="empty-state">Cargando ocupacion...</div>
      ) : rooms.length === 0 ? (
        <div className="empty-state">
          Aun no hay habitaciones cargadas. Usa Tipos y Habitaciones para preparar el inventario.
        </div>
      ) : (
        <div className="surface-card overflow-x-auto rounded-[30px]">
          <table className="min-w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr className="bg-[var(--surface-muted)]">
                <th className="sticky left-0 z-20 min-w-[220px] bg-[var(--surface-muted)] px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Habitacion
                </th>
                {days.map((day) => (
                  <th
                    key={day.iso}
                    className="min-w-[92px] px-3 py-3 text-center text-xs font-semibold uppercase tracking-[0.18em] text-slate-500"
                  >
                    <div>{day.label}</div>
                    <div className="mt-1 text-[11px] font-normal text-slate-400">{day.day}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rooms.map((room) => (
                <tr key={room.id}>
                  <td className="sticky left-0 z-10 border-t border-[rgba(36,87,255,0.1)] bg-white px-4 py-4 align-top">
                    <div className="font-medium text-slate-900">{room.room_number}</div>
                    <div className="mt-1 text-sm text-slate-500">
                      {room.room_type?.name ?? 'Sin tipo'}
                    </div>
                  </td>
                  {days.map((day) => {
                    const reservation = findReservationForDay(reservations, room.id, day.iso)
                    return (
                      <td
                        key={`${room.id}-${day.iso}`}
                        className="border-t border-[rgba(36,87,255,0.1)] px-2 py-2 align-top"
                      >
                        {reservation ? (
                          <button
                            type="button"
                            onClick={() => setSelectedReservation(reservation)}
                            className={`w-full rounded-2xl px-2 py-2 text-left text-xs ${
                              reservation.status === 'cancelled'
                                ? 'bg-[rgba(239,68,68,0.12)] text-red-700'
                                : 'bg-[rgba(36,87,255,0.12)] text-slate-700'
                            }`}
                          >
                            <div className="font-semibold text-slate-900">
                              {reservation.guest?.name ?? 'Reserva'}
                            </div>
                            <div className="mt-1">{getStatusLabel(reservation.status)}</div>
                          </button>
                        ) : (
                          <div className="rounded-2xl border border-dashed border-[rgba(36,87,255,0.16)] px-2 py-3 text-center text-xs text-slate-400">
                            Libre
                          </div>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedReservation && (
        <ModalShell title="Detalle de reserva" onClose={() => setSelectedReservation(null)}>
          <div className="space-y-4 text-sm text-slate-600">
            <DetailRow label="Huesped" value={selectedReservation.guest?.name ?? 'Sin huesped'} />
            <DetailRow label="Telefono" value={selectedReservation.guest?.phone ?? 'Sin telefono'} />
            <DetailRow label="Habitacion" value={selectedReservation.room?.room_number ?? 'Sin asignar'} />
            <DetailRow
              label="Fechas"
              value={`${selectedReservation.check_in} a ${selectedReservation.check_out}`}
            />
            <DetailRow label="Estado" value={getStatusLabel(selectedReservation.status)} />
            <DetailRow label="Origen" value={selectedReservation.source ?? 'Sin origen'} />
            <DetailRow label="Notas" value={selectedReservation.notes ?? 'Sin notas'} />
          </div>
        </ModalShell>
      )}
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat-card">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
        {label}
      </p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{value}</p>
    </div>
  )
}

function LegendSwatch({ label, className }: { label: string; className: string }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-2">
      <span className={`h-3 w-3 rounded-full ${className}`} />
      <span>{label}</span>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-1 text-sm text-slate-700">{value}</p>
    </div>
  )
}

function shiftMonth(date: Date, amount: number) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + amount, 1))
}

function getDaysInMonth(date: Date) {
  const year = date.getUTCFullYear()
  const month = date.getUTCMonth()
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()

  return Array.from({ length: daysInMonth }, (_, index) => {
    const day = new Date(Date.UTC(year, month, index + 1))
    return {
      iso: day.toISOString().slice(0, 10),
      label: new Intl.DateTimeFormat('es-PE', {
        weekday: 'short',
        timeZone: 'UTC',
      }).format(day),
      day: String(index + 1).padStart(2, '0'),
    }
  })
}

function findReservationForDay(
  reservations: GridReservation[],
  roomId: string,
  day: string
) {
  return reservations.find((reservation) => isReservationActiveOnDay(reservation, roomId, day))
}

function isReservationActiveOnDay(
  reservation: GridReservation,
  roomId: string,
  day: string
) {
  if (reservation.room_id !== roomId) return false
  return reservation.check_in <= day && day < reservation.check_out
}

function getStatusLabel(status: Reservation['status']) {
  if (status === 'confirmed') return 'Confirmada'
  if (status === 'cancelled') return 'Cancelada'
  if (status === 'completed') return 'Completada'
  return 'Pendiente'
}
