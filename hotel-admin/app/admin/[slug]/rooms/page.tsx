'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Room, RoomType } from '@/lib/types'
import {
  CrudPageShell,
  ErrorMessage,
  Field,
  ModalActions,
  ModalShell,
} from '../crud-shared'

export default function RoomsPage() {
  const { slug } = useParams<{ slug: string }>()
  const [rooms, setRooms] = useState<Room[]>([])
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Room | null>(null)

  async function load() {
    const [roomsData, roomTypesData] = await Promise.all([
      fetch(`/api/hotels/${slug}/rooms`).then((r) => r.json()),
      fetch(`/api/hotels/${slug}/room-types`).then((r) => r.json()),
    ])

    setRooms(Array.isArray(roomsData) ? roomsData : [])
    setRoomTypes(Array.isArray(roomTypesData) ? roomTypesData : [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [slug])

  return (
    <CrudPageShell
      eyebrow="Inventario"
      title="Habitaciones"
      description="Mantem el inventario activo con numero, tipo, piso y notas operativas."
      buttonLabel="Agregar habitacion"
      loading={loading}
      emptyText="Aun no hay habitaciones agregadas."
      onAdd={() => {
        setEditing(null)
        setShowForm(true)
      }}
    >
      <div className="surface-card overflow-hidden rounded-[30px]">
        <table className="data-table">
          <thead>
            <tr>
              <th>Habitacion</th>
              <th>Tipo</th>
              <th>Piso</th>
              <th aria-label="actions" />
            </tr>
          </thead>
          <tbody>
            {rooms.map((room) => (
              <tr key={room.id}>
                <td>
                  <div className="font-medium text-slate-900">{room.room_number}</div>
                  {room.notes && <div className="mt-1 text-sm text-slate-500">{room.notes}</div>}
                </td>
                <td className="text-slate-700">{room.room_type?.name ?? 'Sin tipo'}</td>
                <td className="text-slate-700">{room.floor ?? '-'}</td>
                <td className="text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => {
                        setEditing(room)
                        setShowForm(true)
                      }}
                      className="button-ghost"
                    >
                      Editar
                    </button>
                    <button
                      onClick={async () => {
                        await fetch(`/api/hotels/${slug}/rooms/${room.id}`, {
                          method: 'DELETE',
                        })
                        load()
                      }}
                      className="button-ghost text-red-600"
                    >
                      Fuera de servicio
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <RoomModal
          slug={slug}
          room={editing}
          roomTypes={roomTypes}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false)
            load()
          }}
        />
      )}
    </CrudPageShell>
  )
}

function RoomModal({
  slug,
  room,
  roomTypes,
  onClose,
  onSaved,
}: {
  slug: string
  room: Room | null
  roomTypes: RoomType[]
  onClose: () => void
  onSaved: () => void
}) {
  const [roomNumber, setRoomNumber] = useState(room?.room_number ?? '')
  const [roomTypeId, setRoomTypeId] = useState(room?.room_type_id ?? '')
  const [floor, setFloor] = useState(room?.floor ?? '')
  const [notes, setNotes] = useState(room?.notes ?? '')
  const [active, setActive] = useState(room?.active ?? true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const url = room
      ? `/api/hotels/${slug}/rooms/${room.id}`
      : `/api/hotels/${slug}/rooms`
    const method = room ? 'PATCH' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        room_number: roomNumber,
        room_type_id: roomTypeId || null,
        floor: floor || null,
        notes: notes || null,
        active,
      }),
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'Error al guardar habitacion')
      setLoading(false)
      return
    }

    onSaved()
  }

  return (
    <ModalShell title={room ? 'Editar habitacion' : 'Nueva habitacion'} onClose={onClose}>
      <form onSubmit={handleSave} className="space-y-4">
        <Field label="Numero de habitacion" required>
          <input className="app-input" value={roomNumber} onChange={(e) => setRoomNumber(e.target.value)} required />
        </Field>
        <Field label="Tipo">
          <select className="app-select" value={roomTypeId} onChange={(e) => setRoomTypeId(e.target.value)}>
            <option value="">Sin tipo asignado</option>
            {roomTypes.map((roomType) => (
              <option key={roomType.id} value={roomType.id}>
                {roomType.name}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Piso">
            <input className="app-input" value={floor} onChange={(e) => setFloor(e.target.value)} />
          </Field>
          <Field label="Notas">
            <input className="app-input" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </div>
        <label className="flex items-center gap-3 rounded-2xl bg-[var(--surface-muted)] px-4 py-3 text-sm text-slate-700">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          Habitacion activa
        </label>
        {error && <ErrorMessage error={error} />}
        <ModalActions onClose={onClose} loading={loading} label="Guardar habitacion" />
      </form>
    </ModalShell>
  )
}
