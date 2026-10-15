import type { HTMLAttributes } from 'react'

/** A filled surface one tone step off the ground: no outline, no shadow. */
export function Card({ className = '', children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...rest} className={`bg-paper ${className}`}>
      {children}
    </div>
  )
}

export function CardBody({ className = '', children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...rest} className={`p-5 sm:p-6 ${className}`}>
      {children}
    </div>
  )
}
