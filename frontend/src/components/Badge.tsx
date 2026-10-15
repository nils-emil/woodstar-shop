import type { ReactNode } from 'react'
import type { LockerState, OrderState } from '@/api/types'

type Tone = 'neutral' | 'green' | 'amber' | 'red' | 'blue'

const tones: Record<Tone, string> = {
  neutral: 'bg-surface text-ink',
  green: 'bg-success-50 text-success-700',
  amber: 'bg-warn-50 text-warn-700',
  red: 'bg-danger-50 text-danger-700',
  blue: 'bg-accent-50 text-accent-800',
}

export function Badge({ tone = 'neutral', children, className = '' }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-[13px] font-semibold whitespace-nowrap ${tones[tone]} ${className}`}>
      {children}
    </span>
  )
}

export const orderStateTone: Record<OrderState, Tone> = {
  PENDING_PAYMENT: 'amber',
  PAID: 'blue',
  PICKED_UP: 'green',
  EXPIRED: 'neutral',
  CANCELLED: 'neutral',
  REFUNDED: 'red',
}

export const lockerStateTone: Record<LockerState, Tone> = {
  EMPTY: 'neutral',
  STOCKED: 'green',
  RESERVED: 'amber',
  SOLD: 'blue',
  OUT_OF_ORDER: 'red',
}
