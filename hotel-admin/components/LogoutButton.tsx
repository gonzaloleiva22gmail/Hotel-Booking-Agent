'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function LogoutButton({
  className = '',
  onAfterLogout,
}: {
  className?: string
  onAfterLogout?: () => void
}) {
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    onAfterLogout?.()
    router.push('/login')
  }

  return (
    <button
      onClick={handleLogout}
      className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm text-slate-500 hover:bg-white/70 hover:text-slate-900 ${className}`.trim()}
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-900/5 text-[11px] font-semibold tracking-[0.22em] text-slate-500">
        OUT
      </span>
      <span className="font-medium">Cerrar sesion</span>
    </button>
  )
}
