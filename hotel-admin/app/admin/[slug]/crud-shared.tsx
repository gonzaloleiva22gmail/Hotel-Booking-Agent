'use client'

export function CrudPageShell({
  eyebrow,
  title,
  description,
  buttonLabel,
  loading,
  emptyText,
  onAdd,
  children,
  actionDisabled,
}: {
  eyebrow: string
  title: string
  description: string
  buttonLabel: string
  loading: boolean
  emptyText: string
  onAdd: () => void
  children: React.ReactNode
  actionDisabled?: boolean
}) {
  return (
    <div className="page-shell">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <span className="eyebrow">{eyebrow}</span>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950">
            {title}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{description}</p>
        </div>
        <button onClick={onAdd} className="button-primary disabled:opacity-60" disabled={actionDisabled}>
          {buttonLabel}
        </button>
      </div>

      {loading ? <div className="empty-state">Cargando...</div> : children || <div className="empty-state">{emptyText}</div>}
    </div>
  )
}

export function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(10,10,46,0.42)] p-3 backdrop-blur-sm sm:p-4"
      onClick={onClose}
    >
      <div
        className="surface-card w-full max-w-md rounded-[32px] p-5 max-h-[90dvh] overflow-y-auto sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
              Catalogo
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
              {title}
            </h2>
          </div>
          <button onClick={onClose} className="button-ghost px-3 py-2">
            Cerrar
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Field({
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

export function ErrorMessage({ error }: { error: string }) {
  return (
    <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {error}
    </p>
  )
}

export function ModalActions({
  onClose,
  loading,
  label,
}: {
  onClose: () => void
  loading: boolean
  label: string
}) {
  return (
    <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
      <button type="button" onClick={onClose} className="button-secondary">
        Cancelar
      </button>
      <button type="submit" disabled={loading} className="button-primary disabled:opacity-60">
        {loading ? 'Guardando...' : label}
      </button>
    </div>
  )
}
