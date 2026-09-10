import type { ReactNode } from 'react'
import type { LockerState, OrderState } from '@/api/types'

type Tone = 'neutral' | 'green' | 'amber' | 'red' | 'blue' | 'wood'

const tones: Record<Tone, string> = {
  neutral: 'bg-stone-100 text-stone-700',
  green: 'bg-green-100 text-green-800',
  amber: 'bg-amber-100 text-amber-800',
  red: 'bg-red-100 text-red-800',
  blue: 'bg-sky-100 text-sky-800',
  wood: 'bg-wood-100 text-wood-800',
}

export function Badge({ tone = 'neutral', children, className = '' }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${tones[tone]} ${className}`}>
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
