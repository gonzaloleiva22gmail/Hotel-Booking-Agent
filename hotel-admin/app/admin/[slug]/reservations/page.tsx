'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Reservation, ReservationStatus, Room } from '@/lib/types'
import {
  CrudPageShell,
  ErrorMessage,
  Field,
  ModalActions,
  ModalShell,
} from '../crud-shared'

type ReservationRecord = Reservation & { room?: Room | null }

const STATUS_OPTIONS: ReservationStatus[] = ['pending', 'confirmed', 'cancelled', 'completed']

export default function ReservationsPage() {
  const { slug } = useParams<{ slug: string }>()
  const [reservations, setReservations] = useState<ReservationRecord[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [editing, setEditing] = useState<ReservationRecord | null>(null)

  async function load() {
    setLoading(true)
    const statusQuery = statusFilter === 'all' ? '' : `?status=${statusFilter}`
    const [reservationData, roomsData] = await Promise.all([
      fetch(`/api/hotels/${slug}/reservations${statusQuery}`).then((r) => r.json()),
      fetch(`/api/hotels/${slug}/rooms`).then((r) => r.json()),
    ])

    setReservations(Array.isArray(reservationData) ? reservationData : [])
    setRooms(Array.isArray(roomsData) ? roomsData : [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [slug, statusFilter])

  return (
    <CrudPageShell
      eyebrow="Operaciones"
      title="Reservas"
      description="Revisa fechas, huespedes, habitaciones y estado actual de cada reserva."
      buttonLabel="Actualizar vista"
      loading={loading}
      emptyText="Aun no hay reservas visibles."
      onAdd={() => load()}
    >
      <div className="mb-4 flex justify-end">
        <select
          className="app-select max-w-[220px]"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">Todos los estados</option>
          {STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>
              {getStatusLabel(status)}
            </option>
          ))}
        </select>
      </div>

      {reservations.length === 0 ? (
        <div className="empty-state">No hay reservas para los filtros actuales.</div>
      ) : (
        <div className="surface-card overflow-hidden rounded-[30px]">
          <table className="data-table">
            <thead>
              <tr>
                <th>Huesped</th>
                <th>Habitacion</th>
                <th>Fechas</th>
                <th>Estado</th>
                <th aria-label="actions" />
              </tr>
            </thead>
            <tbody>
              {reservations.map((reservation) => (
                <tr key={reservation.id}>
                  <td>
                    <div className="font-medium text-slate-900">{reservation.guest?.name ?? '-'}</div>
                    <div className="mt-1 text-sm text-slate-500">{reservation.guest?.phone ?? 'Sin telefono'}</div>
                  </td>
                  <td className="text-slate-700">{reservation.room?.room_number ?? 'Sin asignar'}</td>
                  <td className="text-slate-700">
                    {reservation.check_in} - {reservation.check_out}
                  </td>
                  <td>
                    <span className="status-pill bg-[rgba(36,87,255,0.12)] text-[var(--brand-strong)]">
                      {getStatusLabel(reservation.status)}
                    </span>
                  </td>
                  <td className="text-right">
                    <button
                      onClick={() => setEditing(reservation)}
                      className="button-ghost"
                    >
                      Ver / editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <ReservationModal
          slug={slug}
          reservation={editing}
          rooms={rooms}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            load()
          }}
        />
      )}
    </CrudPageShell>
  )
}

function ReservationModal({
  slug,
  reservation,
  rooms,
  onClose,
  onSaved,
}: {
  slug: string
  reservation: ReservationRecord
  rooms: Room[]
  onClose: () => void
  onSaved: () => void
}) {
  const [status, setStatus] = useState<ReservationStatus>(reservation.status)
  const [roomId, setRoomId] = useState(reservation.room_id ?? '')
  const [checkIn, setCheckIn] = useState(reservation.check_in)
  const [checkOut, setCheckOut] = useState(reservation.check_out)
  const [notes, setNotes] = useState(reservation.notes ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await fetch(`/api/hotels/${slug}/reservations/${reservation.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status,
        room_id: roomId || null,
        check_in: checkIn,
        check_out: checkOut,
        notes: notes || null,
      }),
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'Error al guardar reserva')
      setLoading(false)
      return
    }

    onSaved()
  }

  return (
    <ModalShell title="Detalle de reserva" onClose={onClose}>
      <div className="mb-5 grid gap-3 rounded-[24px] bg-[var(--surface-muted)] p-4 text-sm text-slate-600">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Huesped</p>
          <p className="mt-1 text-sm text-slate-800">{reservation.guest?.name ?? 'Sin huesped'}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Telefono</p>
          <p className="mt-1 text-sm text-slate-800">{reservation.guest?.phone ?? 'Sin telefono'}</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        <Field label="Estado">
          <select className="app-select" value={status} onChange={(e) => setStatus(e.target.value as ReservationStatus)}>
            {STATUS_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {getStatusLabel(option)}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Habitacion">
          <select className="app-select" value={roomId} onChange={(e) => setRoomId(e.target.value)}>
            <option value="">Sin asignar</option>
            {rooms.map((room) => (
              <option key={room.id} value={room.id}>
                {room.room_number}
              </option>
            ))}
          </select>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Check-in">
            <input className="app-input" type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
          </Field>
          <Field label="Check-out">
            <input className="app-input" type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
          </Field>
        </div>

        <Field label="Notas">
          <textarea className="app-textarea" value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} />
        </Field>

        {error && <ErrorMessage error={error} />}
        <ModalActions onClose={onClose} loading={loading} label="Guardar reserva" />
      </form>
    </ModalShell>
  )
}

function getStatusLabel(status: ReservationStatus) {
  if (status === 'confirmed') return 'Confirmada'
  if (status === 'cancelled') return 'Cancelada'
  if (status === 'completed') return 'Completada'
  return 'Pendiente'
}
