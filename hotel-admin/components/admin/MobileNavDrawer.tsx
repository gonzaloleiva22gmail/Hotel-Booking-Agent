'use client'

import AdminSidebarNav from '@/components/admin/AdminSidebarNav'
import LogoutButton from '@/components/LogoutButton'

type NavItem = {
  href: string
  label: string
  code: string
}

export default function MobileNavDrawer({
  clinicName,
  navItems,
  open,
  onClose,
}: {
  clinicName: string
  navItems: NavItem[]
  open: boolean
  onClose: () => void
}) {
  return (
    <div
      className={`fixed inset-0 z-40 transition ${open ? 'pointer-events-auto' : 'pointer-events-none'}`}
      aria-hidden={!open}
    >
      <button
        type="button"
        onClick={onClose}
        className={`absolute inset-0 bg-[rgba(10,10,46,0.42)] backdrop-blur-sm transition-opacity ${
          open ? 'opacity-100' : 'opacity-0'
        }`}
        aria-label="Cerrar menu"
      />

      <div
        className={`absolute left-0 top-0 flex h-full w-[18rem] max-w-[86vw] flex-col bg-transparent p-3 transition-transform duration-200 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="rounded-[28px] bg-slate-950 px-5 py-5 text-white shadow-[0_24px_64px_rgba(15,23,42,0.34)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.26em] text-white/55">
                Hotel Admin
              </p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight">{clinicName}</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl bg-white/10 px-3 py-2 text-sm text-white/80 hover:bg-white/15"
            >
              Cerrar
            </button>
          </div>
          <p className="mt-2 text-sm text-white/70">
            Navega rapido entre las secciones clave desde tu telefono.
          </p>
        </div>

        <div className="glass-panel mt-4 flex min-h-0 flex-1 flex-col rounded-[28px] p-3">
          <AdminSidebarNav items={navItems} onItemClick={onClose} />
          <div className="mt-auto border-t border-white/60 pt-3">
            <LogoutButton onAfterLogout={onClose} />
          </div>
        </div>
      </div>
    </div>
  )
}
