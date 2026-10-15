import type { ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react'

type Tone = 'info' | 'success' | 'warning' | 'error'

const styles: Record<Tone, string> = {
  info: 'bg-paper text-ink',
  success: 'bg-success-50 text-success-700',
  warning: 'bg-warn-50 text-warn-700',
  error: 'bg-danger-50 text-danger-700',
}

const icons: Record<Tone, ReactNode> = {
  info: <Info size={20} />,
  success: <CheckCircle2 size={20} />,
  warning: <AlertTriangle size={20} />,
  error: <XCircle size={20} />,
}

export function Alert({ tone = 'info', children, className = '' }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <div className={`flex items-start gap-3 px-4 py-3.5 text-[16px] font-medium ${styles[tone]} ${className}`} role="alert">
      <span className="shrink-0 mt-0.5">{icons[tone]}</span>
      <div className="flex-1">{children}</div>
    </div>
  )
}
