'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

type NavItem = {
  href: string
  label: string
  code: string
}

export default function AdminSidebarNav({
  items,
  onItemClick,
  className = '',
}: {
  items: NavItem[]
  onItemClick?: () => void
  className?: string
}) {
  const pathname = usePathname()

  return (
    <nav className={`flex-1 space-y-1 ${className}`.trim()}>
      {items.map((item) => {
        const active = pathname === item.href

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onItemClick}
            className={`group flex items-center gap-3 rounded-2xl px-3 py-3 text-sm ${
              active
                ? 'bg-[var(--brand-soft)] text-[var(--brand-strong)] shadow-[inset_0_0_0_1px_rgba(36,87,255,0.12)]'
                : 'text-slate-600 hover:bg-white/70 hover:text-slate-900'
            }`}
          >
            <span
              className={`flex h-9 w-9 items-center justify-center rounded-2xl text-[11px] font-semibold tracking-[0.22em] ${
                active
                  ? 'bg-white text-[var(--brand-strong)] shadow-sm'
                  : 'bg-slate-900/5 text-slate-500 group-hover:bg-white'
              }`}
            >
              {item.code}
            </span>
            <span className="font-medium">{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
