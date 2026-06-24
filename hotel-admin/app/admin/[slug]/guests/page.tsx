'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Guest } from '@/lib/types'

export default function GuestsPage() {
  const { slug } = useParams<{ slug: string }>()
  const [guests, setGuests] = useState<Guest[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      const data = await fetch(`/api/hotels/${slug}/guests?${params}`).then((r) => r.json())
      setGuests(Array.isArray(data) ? data : [])
      setLoading(false)
    }

    load()
  }, [slug, search])

  return (
    <div className="page-shell">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <span className="eyebrow">Relacion con clientes</span>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950">
            Huespedes
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Busca huespedes por nombre y revisa los datos que alimentaran el historial de reservas.
          </p>
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="app-input md:max-w-[320px]"
          placeholder="Buscar huesped"
        />
      </div>

      {loading ? (
        <div className="empty-state">Cargando huespedes...</div>
      ) : guests.length === 0 ? (
        <div className="empty-state">No hay huespedes para los filtros actuales.</div>
      ) : (
        <div className="surface-card overflow-hidden rounded-[30px]">
          <table className="data-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Telefono</th>
                <th>Notas</th>
              </tr>
            </thead>
            <tbody>
              {guests.map((guest) => (
                <tr key={guest.id}>
                  <td className="font-medium text-slate-900">{guest.name}</td>
                  <td className="text-slate-700">{guest.phone ?? 'Sin telefono'}</td>
                  <td className="text-slate-500">{guest.notes ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
