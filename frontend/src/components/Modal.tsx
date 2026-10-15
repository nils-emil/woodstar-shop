import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { useT } from '@/i18n'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  footer?: ReactNode
}

function useEscape(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
}

// Dialogs are the one thing on the page that truly floats, so they keep a shadow.
const floating = 'shadow-[0_24px_64px_-16px_rgb(38_37_30/0.45)]' // taste-skill-ignore: dialogs float

function Head({ title, onClose }: { title?: string; onClose: () => void }) {
  const { t } = useT()
  return (
    <div className="flex items-center justify-between gap-4 px-6 pt-6 pb-2">
      <h2 className="text-2xl font-extrabold tracking-[-0.03em] text-ink">{title}</h2>
      <button onClick={onClose} className="btn btn-ghost !min-h-10 !px-2" aria-label={t('close')}>
        <X size={22} />
      </button>
    </div>
  )
}

export function Modal({ open, onClose, title, children, footer }: ModalProps) {
  useEscape(open, onClose)
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-ink/60" onClick={onClose} />
      <div className={`enter relative w-full sm:max-w-lg bg-canvas max-h-[90dvh] flex flex-col ${floating}`}>
        <Head title={title} onClose={onClose} />
        <div className="px-6 py-4 overflow-y-auto">{children}</div>
        {footer && <div className="px-6 pb-6 pt-2 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  )
}

export function Drawer({ open, onClose, title, children }: ModalProps) {
  useEscape(open, onClose)
  if (!open) return null
  return (
    <div className="fixed inset-0 z-40" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-ink/50" onClick={onClose} />
      <aside className={`absolute right-0 top-0 h-full w-full sm:w-[30rem] bg-canvas flex flex-col ${floating}`}>
        <Head title={title} onClose={onClose} />
        <div className="flex-1 overflow-y-auto px-6 py-4">{children}</div>
      </aside>
    </div>
  )
}

interface ConfirmProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
  loading?: boolean
  onConfirm: () => void
  onClose: () => void
}

export function ConfirmDialog({ open, title, message, confirmLabel, danger, loading, onConfirm, onClose }: ConfirmProps) {
  const { t } = useT()
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <button onClick={onClose} className="btn btn-tone">
            {t('cancel')}
          </button>
          <button onClick={onConfirm} disabled={loading} className={`btn ${danger ? 'btn-danger' : 'btn-ink'}`}>
            {confirmLabel ?? t('confirm')}
          </button>
        </>
      }
    >
      <p className="text-ink">{message}</p>
    </Modal>
  )
}
