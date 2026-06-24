'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return

    const { data: member } = await supabase
      .from('hotel_members')
      .select('hotel:hotels(slug)')
      .eq('user_id', user.id)
      .single()

    const slug = (member?.hotel as { slug?: string } | null)?.slug

    if (slug) {
      router.push(`/admin/${slug}`)
    } else {
      setError('No se encontro un hotel para esta cuenta.')
      setLoading(false)
    }
  }

  return (
    <div className="page-shell flex min-h-screen items-center">
      <div className="grid w-full gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="glass-panel relative overflow-hidden rounded-[36px] p-8 md:p-10">
          <div className="absolute -left-12 top-8 h-40 w-40 rounded-full bg-[rgba(36,87,255,0.15)] blur-3xl" />
          <div className="absolute bottom-0 right-0 h-48 w-48 rounded-full bg-[rgba(13,138,111,0.15)] blur-3xl" />

          <div className="relative">
            <span className="eyebrow">Control hotelero</span>
            <h1 className="mt-6 max-w-2xl text-4xl font-semibold tracking-tight text-slate-950 md:text-6xl">
              Un panel claro para ver ocupacion, habitaciones y reservas sin perder contexto.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-slate-600 md:text-lg">
              Revisa llegadas, salidas y disponibilidad en un mismo flujo pensado para
              recepcion y operacion diaria.
            </p>

            <div className="mt-10 grid gap-4 md:grid-cols-3">
              <InfoCard
                value="Ocupacion mensual"
                label="Visualiza habitaciones y estadias por dia en una sola vista."
              />
              <InfoCard
                value="Inventario listo"
                label="Administra tipos de habitacion, habitaciones y ajustes del hotel."
              />
              <InfoCard
                value="Base para automatizacion"
                label="Conecta la operacion del panel con reservas generadas por WhatsApp."
              />
            </div>
          </div>
        </section>

        <section className="surface-card rounded-[36px] p-8 md:p-10">
          <div className="mb-8">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-400">
              Hotel Admin
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
              Iniciar sesion
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Accede al panel del hotel para ver ocupacion y reservas.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <Field label="Email">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="app-input"
                placeholder="name@hotel.com"
              />
            </Field>

            <Field label="Contrasena">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="app-input"
                placeholder="Ingresa tu contrasena"
              />
            </Field>

            {error && (
              <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </p>
            )}

            <button type="submit" disabled={loading} className="button-primary w-full disabled:opacity-60">
              {loading ? 'Ingresando...' : 'Entrar al panel'}
            </button>
          </form>
        </section>
      </div>
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

function InfoCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-[28px] border border-white/60 bg-white/72 p-5 shadow-[0_16px_40px_rgba(17,24,39,0.08)]">
      <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[var(--brand-strong)]">
        {value}
      </p>
      <p className="mt-3 text-sm leading-6 text-slate-600">{label}</p>
    </div>
  )
}
