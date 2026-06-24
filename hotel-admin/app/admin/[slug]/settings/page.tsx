'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

export default function SettingsPage() {
  const { slug } = useParams<{ slug: string }>()
  const [form, setForm] = useState({
    name: '',
    phone: '',
    address: '',
    timezone: 'America/Lima',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    async function load() {
      const data = await fetch(`/api/hotels/${slug}/settings`).then((r) => r.json())
      setForm({
        name: data.name ?? '',
        phone: data.phone ?? '',
        address: data.address ?? '',
        timezone: data.timezone ?? 'America/Lima',
      })
      setLoading(false)
    }

    load()
  }, [slug])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMessage('')

    const res = await fetch(`/api/hotels/${slug}/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })

    setSaving(false)
    setMessage(res.ok ? 'Cambios guardados.' : 'No se pudieron guardar los cambios.')
  }

  return (
    <div className="page-shell">
      <div className="mb-6">
        <span className="eyebrow">Configuracion</span>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950">
          Ajustes del hotel
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
          Actualiza nombre, telefono, direccion y zona horaria del hotel.
        </p>
      </div>

      {loading ? (
        <div className="empty-state">Cargando ajustes...</div>
      ) : (
        <form onSubmit={handleSubmit} className="surface-card max-w-3xl rounded-[30px] p-6 space-y-4">
          <Field label="Nombre">
            <input className="app-input" value={form.name} onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))} />
          </Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Telefono">
              <input className="app-input" value={form.phone} onChange={(e) => setForm((current) => ({ ...current, phone: e.target.value }))} />
            </Field>
            <Field label="Zona horaria">
              <input className="app-input" value={form.timezone} onChange={(e) => setForm((current) => ({ ...current, timezone: e.target.value }))} />
            </Field>
          </div>
          <Field label="Direccion">
            <input className="app-input" value={form.address} onChange={(e) => setForm((current) => ({ ...current, address: e.target.value }))} />
          </Field>
          {message && <p className="text-sm text-slate-500">{message}</p>}
          <div className="flex justify-end">
            <button type="submit" disabled={saving} className="button-primary disabled:opacity-60">
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  )
}
