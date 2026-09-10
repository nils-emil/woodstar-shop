/** Woodstar mark: a log end with a star-shaped heartwood, in the accent colour. */
export function Logo({ size = 32, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="#c04e16" />
      <circle cx="16" cy="16" r="9.5" stroke="#fff" strokeWidth="1.8" opacity="0.9" />
      <circle cx="16" cy="16" r="5.5" stroke="#fff" strokeWidth="1.8" opacity="0.6" />
      <path d="M16 12.2l1.2 2.5 2.7.4-2 1.9.5 2.7-2.4-1.3-2.4 1.3.5-2.7-2-1.9 2.7-.4z" fill="#fff" />
    </svg>
  )
}
