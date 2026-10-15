import type { SelectHTMLAttributes } from 'react'
import { ChevronDown } from 'lucide-react'

interface Props extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
}

export function Select({ label, className = '', id, children, ...rest }: Props) {
  const selectId = id ?? rest.name
  return (
    <label className="block" htmlFor={selectId}>
      {label && <span className="mb-1.5 block text-[15px] font-semibold text-ink">{label}</span>}
      <span className="select-wrap block">
        <select id={selectId} {...rest} className={`field ${className}`}>
          {children}
        </select>
        <ChevronDown size={18} aria-hidden="true" />
      </span>
    </label>
  )
}
