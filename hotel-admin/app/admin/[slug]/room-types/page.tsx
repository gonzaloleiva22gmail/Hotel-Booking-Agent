'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { RoomType } from '@/lib/types'
import {
  CrudPageShell,
  ErrorMessage,
  Field,
  ModalActions,
  ModalShell,
} from '../crud-shared'

export default function RoomTypesPage() {
  const { slug } = useParams<{ slug: string }>()
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<RoomType | null>(null)

  async function load() {
    const data = await fetch(`/api/hotels/${slug}/room-types`).then((r) => r.json())
    setRoomTypes(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [slug])

  return (
    <CrudPageShell
      eyebrow="Catalogo base"
      title="Tipos de habitacion"
      description="Define capacidad, precio y descripcion base para los tipos que alimentan el inventario."
      buttonLabel="Agregar tipo"
      loading={loading}
      emptyText="Aun no hay tipos de habitacion agregados."
      onAdd={() => {
        setEditing(null)
        setShowForm(true)
      }}
    >
      <div className="surface-card overflow-hidden rounded-[30px]">
        <table className="data-table">
          <thead>
            <tr>
              <th>Tipo</th>
              <th>Capacidad</th>
              <th>Precio</th>
              <th aria-label="actions" />
            </tr>
          </thead>
          <tbody>
            {roomTypes.map((roomType) => (
              <tr key={roomType.id}>
                <td>
                  <div className="font-medium text-slate-900">{roomType.name}</div>
                  {roomType.description && (
                    <div className="mt-1 text-sm text-slate-500">{roomType.description}</div>
                  )}
                </td>
                <td className="text-slate-700">{roomType.capacity ?? '-'}</td>
                <td className="text-slate-700">
                  {roomType.price != null ? `S/ ${Number(roomType.price).toFixed(2)}` : '-'}
                </td>
                <td className="text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => {
                        setEditing(roomType)
                        setShowForm(true)
                      }}
                      className="button-ghost"
                    >
                      Editar
                    </button>
                    <button
                      onClick={async () => {
                        await fetch(`/api/hotels/${slug}/room-types/${roomType.id}`, {
                          method: 'DELETE',
                        })
                        load()
                      }}
                      className="button-ghost text-red-600"
                    >
                      Desactivar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <RoomTypeModal
          slug={slug}
          roomType={editing}
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

function RoomTypeModal({
  slug,
  roomType,
  onClose,
  onSaved,
}: {
  slug: string
  roomType: RoomType | null
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(roomType?.name ?? '')
  const [description, setDescription] = useState(roomType?.description ?? '')
  const [capacity, setCapacity] = useState(roomType?.capacity?.toString() ?? '')
  const [price, setPrice] = useState(roomType?.price?.toString() ?? '')
  const [active, setActive] = useState(roomType?.active ?? true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const url = roomType
      ? `/api/hotels/${slug}/room-types/${roomType.id}`
      : `/api/hotels/${slug}/room-types`
    const method = roomType ? 'PATCH' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        description: description || null,
        capacity: capacity ? Number(capacity) : null,
        price: price ? Number(price) : null,
        active,
      }),
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'Error al guardar tipo')
      setLoading(false)
      return
    }

    onSaved()
  }

  return (
    <ModalShell
      title={roomType ? 'Editar tipo' : 'Nuevo tipo'}
      onClose={onClose}
    >
      <form onSubmit={handleSave} className="space-y-4">
        <Field label="Nombre" required>
          <input className="app-input" value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
        <Field label="Descripcion">
          <textarea className="app-textarea" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Capacidad">
            <input className="app-input" type="number" value={capacity} onChange={(e) => setCapacity(e.target.value)} />
          </Field>
          <Field label="Precio (S/)">
            <input className="app-input" type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
          </Field>
        </div>
        <label className="flex items-center gap-3 rounded-2xl bg-[var(--surface-muted)] px-4 py-3 text-sm text-slate-700">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          Tipo activo
        </label>
        {error && <ErrorMessage error={error} />}
        <ModalActions onClose={onClose} loading={loading} label="Guardar tipo" />
      </form>
    </ModalShell>
  )
}
