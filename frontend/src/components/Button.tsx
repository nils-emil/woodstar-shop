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
  primary: 'btn-ink',
  secondary: 'btn-tone',
  danger: 'btn-danger',
  success: 'btn-success',
  ghost: 'btn-ghost',
  cta: 'btn-accent',
}

const sizes: Record<Size, string> = {
  sm: '!min-h-10 !px-3 !text-[15px]',
  md: '',
  lg: '!min-h-14',
  xl: '!min-h-20 !text-2xl',
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
      className={`btn ${variants[variant]} ${sizes[size]} ${full ? 'w-full' : ''} ${className}`}
    >
      {loading ? <Spinner size={size === 'xl' ? 28 : 18} /> : icon}
      {children}
    </button>
  )
}
