import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Spinner } from './Spinner'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'success' | 'cta'
type Size = 'sm' | 'md' | 'lg' | 'xl'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  full?: boolean
  icon?: ReactNode
}

const variants: Record<Variant, string> = {
  primary: 'bg-ink text-white hover:bg-ink-2 active:bg-ink shadow-sm',
  secondary: 'bg-white text-ink border border-line hover:border-line-strong hover:bg-canvas',
  danger: 'bg-ember-500 text-white hover:bg-ember-600',
  success: 'bg-moss-500 text-white hover:bg-moss-600',
  ghost: 'bg-transparent text-ink hover:bg-canvas',
  cta: 'btn-cta',
}

const sizes: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-11 px-4 text-base',
  lg: 'h-14 px-6 text-lg',
  xl: 'h-20 px-8 text-2xl font-bold',
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  full = false,
  icon,
  className = '',
  children,
  disabled,
  ...rest
}: Props) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors select-none disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-300 ${variants[variant]} ${sizes[size]} ${full ? 'w-full' : ''} ${className}`}
    >
      {loading ? <Spinner size={size === 'xl' ? 28 : 18} /> : icon}
      {children}
    </button>
  )
}
