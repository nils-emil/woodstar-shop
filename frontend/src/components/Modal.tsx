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

export function Modal({ open, onClose, title, children, footer }: ModalProps) {
  const { t } = useT()
  useEscape(open, onClose)
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-bark/50" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl bg-white shadow-xl max-h-[90dvh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-wood-100">
          <h2 className="text-lg font-bold text-wood-900">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-stone-500 hover:bg-wood-100" aria-label={t('close')}>
            <X size={20} />
          </button>
        </div>
        <div className="px-5 py-4 overflow-y-auto">{children}</div>
        {footer && <div className="px-5 py-4 border-t border-wood-100 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  )
}

export function Drawer({ open, onClose, title, children }: ModalProps) {
  const { t } = useT()
  useEscape(open, onClose)
  if (!open) return null
  return (
    <div className="fixed inset-0 z-40" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-bark/40" onClick={onClose} />
      <aside className="absolute right-0 top-0 h-full w-full sm:w-[28rem] bg-white shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-wood-100">
          <h2 className="text-lg font-bold text-wood-900">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-stone-500 hover:bg-wood-100" aria-label={t('close')}>
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
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
          <button onClick={onClose} className="h-11 px-4 rounded-xl font-semibold text-wood-800 hover:bg-wood-100">
            {t('cancel')}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`h-11 px-4 rounded-xl font-semibold text-white disabled:opacity-50 ${danger ? 'bg-ember-500 hover:bg-ember-600' : 'bg-wood-700 hover:bg-wood-800'}`}
          >
            {confirmLabel ?? t('confirm')}
          </button>
        </>
      }
    >
      <p className="text-bark">{message}</p>
    </Modal>
  )
}
