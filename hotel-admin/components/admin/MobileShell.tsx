'use client'

import { useState } from 'react'
import LogoutButton from '@/components/LogoutButton'
import MobileNavDrawer from '@/components/admin/MobileNavDrawer'

type NavItem = {
  href: string
  label: string
  code: string
}

export default function MobileShell({
  hotelName,
  navItems,
}: {
  hotelName: string
  navItems: NavItem[]
}) {
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <>
      <div className="glass-panel mb-4 flex items-center justify-between gap-4 rounded-[28px] px-4 py-4 lg:hidden">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
            Hotel Admin
          </p>
          <p className="mt-1 truncate text-lg font-semibold text-slate-900">{hotelName}</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white/72 text-xl text-slate-700 shadow-[0_12px_24px_rgba(74,49,133,0.08)]"
            aria-label="Abrir menu"
          >
            &#9776;
          </button>
          <div className="hidden sm:block sm:w-[11rem]">
            <LogoutButton />
          </div>
        </div>
      </div>

      <MobileNavDrawer
        clinicName={hotelName}
        navItems={navItems}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </>
  )
}
