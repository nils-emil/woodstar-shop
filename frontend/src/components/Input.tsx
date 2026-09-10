import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react'

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  hint?: string
  error?: string
  variant?: 'light' | 'dark'
}

const base =
  'w-full rounded-xl border border-line bg-white px-3.5 text-base text-ink placeholder:text-ink-4 focus:outline-none focus:ring-2 focus:ring-accent-300 focus:border-accent-400 disabled:bg-canvas transition-colors'

const dark =
  'w-full rounded-xl border border-white/15 bg-white/5 px-3.5 text-base text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-accent-300 focus:bg-white/10 transition-colors'

export function Input({ label, hint, error, variant = 'light', className = '', id, ...rest }: Props) {
  const inputId = id ?? rest.name
  const isDark = variant === 'dark'
  return (
    <label className="block" htmlFor={inputId}>
      {label && <span className={`mb-1.5 block text-sm font-semibold ${isDark ? 'text-white' : 'text-ink'}`}>{label}</span>}
      <input id={inputId} {...rest} className={`${isDark ? dark : base} h-12 ${error ? 'border-danger-500' : ''} ${className}`} />
      {error ? (
        <span className={`mt-1 block text-sm ${isDark ? 'text-danger-500' : 'text-danger-700'}`}>{error}</span>
      ) : hint ? (
        <span className={`mt-1 block text-sm ${isDark ? 'text-white/60' : 'text-ink-3'}`}>{hint}</span>
      ) : null}
    </label>
  )
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
}

export function Textarea({ label, className = '', id, ...rest }: TextareaProps) {
  const inputId = id ?? rest.name
  return (
    <label className="block" htmlFor={inputId}>
      {label && <span className="mb-1.5 block text-sm font-semibold text-ink">{label}</span>}
      <textarea id={inputId} {...rest} className={`${base} py-2.5 min-h-24 ${className}`} />
    </label>
  )
}

export function Checkbox({ label, ...rest }: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="inline-flex items-center gap-2 text-sm font-medium text-wood-800 select-none">
      <input type="checkbox" {...rest} className="h-5 w-5 rounded border-line accent-accent-600" />
      {label}
    </label>
  )
}
