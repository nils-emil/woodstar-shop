import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react'

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  hint?: string
  error?: string
}

export function Input({ label, hint, error, className = '', id, ...rest }: Props) {
  const inputId = id ?? rest.name
  return (
    <label className="block" htmlFor={inputId}>
      {label && <span className="mb-1.5 block text-[15px] font-semibold text-ink">{label}</span>}
      <input id={inputId} aria-invalid={error ? true : undefined} {...rest} className={`field ${className}`} />
      {error ? (
        <span className="mt-1.5 block text-[15px] font-semibold text-danger-700">{error}</span>
      ) : hint ? (
        <span className="mt-1.5 block text-[15px] text-ink-3">{hint}</span>
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
      {label && <span className="mb-1.5 block text-[15px] font-semibold text-ink">{label}</span>}
      <textarea id={inputId} {...rest} className={`field ${className}`} />
    </label>
  )
}

export function Checkbox({ label, ...rest }: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="inline-flex items-center gap-2.5 text-[15px] font-semibold text-ink select-none">
      <input type="checkbox" {...rest} className="h-5 w-5 accent-accent-600" />
      {label}
    </label>
  )
}
