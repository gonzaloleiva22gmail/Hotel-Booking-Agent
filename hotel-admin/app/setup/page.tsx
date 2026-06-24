'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { slugify } from '@/lib/client-utils'

const TIMEZONES = [
  'America/Lima',
  'America/Bogota',
  'America/Santiago',
  'America/Buenos_Aires',
  'America/Mexico_City',
  'America/New_York',
]

export default function SetupPage() {
  const [form, setForm] = useState({
    hotel_name: '',
    slug: '',
    phone: '',
    address: '',
    timezone: 'America/Lima',
    admin_email: '',
    admin_password: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState<{ slug: string } | null>(null)
  const [slugEdited, setSlugEdited] = useState(false)

  useEffect(() => {
    if (slugEdited) return
    setForm((current) => ({
      ...current,
      slug: slugify(current.hotel_name),
    }))
  }, [slugEdited, form.hotel_name])

  function set(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    setLoading(true)
    setError('')

    const res = await fetch('/api/setup/hotel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })

    const data = await res.json()

    if (!res.ok) {
      setError(data.error ?? 'Error al crear el hotel')
      setLoading(false)
      return
    }

    setSuccess({ slug: data.slug })
    setLoading(false)
  }

  return (
    <div className="page-shell py-8 md:py-12">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="glass-panel rounded-[36px] p-8 md:p-10">
          <span className="eyebrow">Flujo de implementacion</span>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight text-slate-950">
            Configura el hotel y deja listo el acceso inicial del equipo.
          </h1>
          <p className="mt-4 text-base leading-7 text-slate-600">
            Esto crea el acceso inicial, el slug, la zona horaria y la base operativa
            para que recepcion gestione habitaciones y reservas.
          </p>

          <div className="mt-8 space-y-4">
            <Step
              index="01"
              title="Crear perfil del hotel"
              body="Define nombre, slug de acceso y datos de contacto para el panel."
            />
            <Step
              index="02"
              title="Provisionar primer administrador"
              body="Genera la cuenta inicial para que el hotel tome control del panel."
            />
            <Step
              index="03"
              title="Abrir el panel"
              body="Entra al dashboard del hotel y continua con habitaciones y ajustes."
            />
          </div>
        </section>

        <section className="surface-card rounded-[36px] p-8 md:p-10">
          <div className="mb-8">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-400">
              Nuevo hotel
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
              Hotel setup
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Crea la cuenta inicial para que el equipo ingrese y configure el panel.
            </p>
          </div>

          {success ? (
            <div className="space-y-5">
              <div className="rounded-[28px] border border-[rgba(139,130,254,0.22)] bg-[linear-gradient(135deg,rgba(74,144,226,0.08),rgba(139,130,254,0.14),rgba(144,19,254,0.08))] p-5">
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[var(--brand-strong)]">
                  Hotel creado
                </p>
                <div className="mt-4 space-y-2 text-sm text-slate-700">
                  <p>
                    Slug: <span className="font-mono text-slate-950">{success.slug}</span>
                  </p>
                  <p>
                    URL de acceso:{' '}
                    <span className="font-mono text-slate-950">/admin/{success.slug}</span>
                  </p>
                  <p>
                    Email admin:{' '}
                    <span className="font-mono text-slate-950">{form.admin_email}</span>
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setSuccess(null)
                    setError('')
                    setSlugEdited(false)
                    setForm({
                      hotel_name: '',
                      slug: '',
                      phone: '',
                      address: '',
                      timezone: 'America/Lima',
                      admin_email: '',
                      admin_password: '',
                    })
                  }}
                  className="button-secondary"
                >
                  Crear otro
                </button>
                <Link href={`/admin/${success.slug}`} className="button-primary">
                  Ir al panel
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <Field label="Nombre del hotel" required>
                <input
                  type="text"
                  value={form.hotel_name}
                  onChange={(e) => set('hotel_name', e.target.value)}
                  required
                  placeholder="Hotel Cascabel"
                  className="app-input"
                />
              </Field>

              <Field label="Slug" required>
                <input
                  type="text"
                  value={form.slug}
                  onChange={(e) => {
                    setSlugEdited(true)
                    set('slug', e.target.value)
                  }}
                  required
                  className="app-input font-mono"
                />
                <p className="mt-2 text-xs text-slate-400">
                  URL de acceso: /admin/{form.slug || '[slug]'}
                </p>
              </Field>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Telefono">
                  <input
                    type="text"
                    value={form.phone}
                    onChange={(e) => set('phone', e.target.value)}
                    placeholder="+51 999 000 000"
                    className="app-input"
                  />
                </Field>

                <Field label="Zona horaria">
                  <select
                    value={form.timezone}
                    onChange={(e) => set('timezone', e.target.value)}
                    className="app-select"
                  >
                    {TIMEZONES.map((timezone) => (
                      <option key={timezone} value={timezone}>
                        {timezone}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <Field label="Direccion">
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => set('address', e.target.value)}
                  placeholder="Oxapampa, Peru"
                  className="app-input"
                />
              </Field>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Email administrador" required>
                  <input
                    type="email"
                    value={form.admin_email}
                    onChange={(e) => set('admin_email', e.target.value)}
                    required
                    className="app-input"
                  />
                </Field>

                <Field label="Contrasena temporal" required>
                  <input
                    type="password"
                    value={form.admin_password}
                    onChange={(e) => set('admin_password', e.target.value)}
                    minLength={8}
                    required
                    className="app-input"
                  />
                </Field>
              </div>

              {error && (
                <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </p>
              )}

              <div className="flex justify-end pt-2">
                <button type="submit" disabled={loading} className="button-primary disabled:opacity-60">
                  {loading ? 'Creando...' : 'Crear hotel'}
                </button>
              </div>
            </form>
          )}
        </section>
      </div>
    </div>
  )
}

function Field({
  label,
  children,
  required,
}: {
  label: string
  children: React.ReactNode
  required?: boolean
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="ml-1 text-[var(--brand-strong)]">*</span>}
      </span>
      {children}
    </label>
  )
}

function Step({
  index,
  title,
  body,
}: {
  index: string
  title: string
  body: string
}) {
  return (
    <div className="rounded-[28px] border border-white/60 bg-white/72 p-5 shadow-[0_16px_40px_rgba(74,49,133,0.08)]">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--brand-strong)]">
        {index}
      </p>
      <h3 className="mt-2 text-lg font-semibold text-slate-950">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
    </div>
  )
}
