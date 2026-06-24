import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import LogoutButton from '@/components/LogoutButton'
import AdminSidebarNav from '@/components/admin/AdminSidebarNav'
import MobileShell from '@/components/admin/MobileShell'
import { createServiceClient } from '@/lib/supabase'

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const supabase = await createServerSupabaseClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const serviceSupabase = createServiceClient()
  const { data: membership } = await serviceSupabase
    .from('hotel_members')
    .select('hotel_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership) redirect('/login')

  const { data: hotel } = await serviceSupabase
    .from('hotels')
    .select('id, name, timezone')
    .eq('slug', slug)
    .single()

  if (!hotel || hotel.id !== membership.hotel_id) redirect('/login')

  const navItems = [
    { href: `/admin/${slug}`, label: 'Ocupacion', code: 'OC' },
    { href: `/admin/${slug}/reservations`, label: 'Reservas', code: 'RS' },
    { href: `/admin/${slug}/room-types`, label: 'Tipos', code: 'TH' },
    { href: `/admin/${slug}/rooms`, label: 'Habitaciones', code: 'HB' },
    { href: `/admin/${slug}/guests`, label: 'Huespedes', code: 'HS' },
    { href: `/admin/${slug}/settings`, label: 'Configuracion', code: 'CF' },
  ]

  return (
    <div className="min-h-screen bg-transparent">
      <div className="mx-auto flex min-h-screen w-full max-w-[1600px] gap-6 px-4 py-4 md:px-6 md:py-6">
        <aside className="glass-panel hidden w-[290px] shrink-0 rounded-[32px] p-5 lg:flex lg:flex-col">
          <div className="rounded-[28px] bg-slate-950 px-5 py-5 text-white shadow-[0_24px_64px_rgba(15,23,42,0.34)]">
            <p className="text-xs font-semibold uppercase tracking-[0.26em] text-white/55">
              Hotel Admin
            </p>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight">
              {hotel?.name ?? slug}
            </h1>
            <p className="mt-2 text-sm text-white/70">
              Ocupacion, habitaciones, huespedes y ajustes del hotel en un solo panel.
            </p>
          </div>

          <div className="mt-5 rounded-[28px] bg-white/72 p-3">
            <AdminSidebarNav items={navItems} />
          </div>

          <div className="mt-5 rounded-[28px] border border-white/60 bg-white/50 p-4 text-sm text-slate-600">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
              Entorno
            </p>
            <p className="mt-3 font-medium text-slate-900">{hotel?.timezone ?? 'America/Lima'}</p>
            <p className="mt-1 text-xs text-slate-500">Slug: {slug}</p>
          </div>

          <div className="mt-auto rounded-[28px] bg-white/72 p-3">
            <LogoutButton />
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <MobileShell hotelName={hotel?.name ?? slug} navItems={navItems} />
          {children}
        </main>
      </div>
    </div>
  )
}
