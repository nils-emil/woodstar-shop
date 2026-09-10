import type { SelectHTMLAttributes } from 'react'

interface Props extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
}

export function Select({ label, className = '', id, children, ...rest }: Props) {
  const selectId = id ?? rest.name
  return (
    <label className="block" htmlFor={selectId}>
      {label && <span className="mb-1.5 block text-sm font-semibold text-wood-800">{label}</span>}
      <select
        id={selectId}
        {...rest}
        className={`h-12 w-full rounded-xl border border-wood-200 bg-white px-3.5 text-base text-bark focus:outline-none focus:ring-2 focus:ring-wood-400 ${className}`}
      >
        {children}
      </select>
    </label>
  )
}
