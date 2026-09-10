import type { ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react'

type Tone = 'info' | 'success' | 'warning' | 'error'

const styles: Record<Tone, string> = {
  info: 'bg-white text-ink border-line',
  success: 'bg-success-50 text-success-700 border-success-500/30',
  warning: 'bg-warn-50 text-warn-700 border-warn-500/30',
  error: 'bg-danger-50 text-danger-700 border-danger-500/30',
}

const icons: Record<Tone, ReactNode> = {
  info: <Info size={20} />,
  success: <CheckCircle2 size={20} />,
  warning: <AlertTriangle size={20} />,
  error: <XCircle size={20} />,
}

const darkStyles: Record<Tone, string> = {
  info: 'bg-white/10 text-white border-white/15',
  success: 'bg-white/10 text-green-200 border-green-400/40',
  warning: 'bg-white/10 text-amber-100 border-amber-300/40',
  error: 'bg-white/10 text-red-100 border-red-400/40',
}

export function Alert({ tone = 'info', variant = 'light', children, className = '' }: { tone?: Tone; variant?: 'light' | 'dark'; children: ReactNode; className?: string }) {
  return (
    <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${variant === 'dark' ? darkStyles[tone] : styles[tone]} ${className}`} role="alert">
      <span className="shrink-0 mt-0.5">{icons[tone]}</span>
      <div className="flex-1">{children}</div>
    </div>
  )
}
