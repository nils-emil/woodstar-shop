import type { HTMLAttributes } from 'react'

export function Card({ className = '', children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...rest} className={`rounded-2xl bg-white border border-wood-200/70 shadow-sm ${className}`}>
      {children}
    </div>
  )
}

export function CardBody({ className = '', children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...rest} className={`p-4 sm:p-5 ${className}`}>
      {children}
    </div>
  )
}
