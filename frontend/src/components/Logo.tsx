/** Woodstar mark: a log end with a star-shaped heartwood. Square, flat, in ink. */
export function Logo({ size = 32, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
      <rect width="32" height="32" fill="currentColor" />
      <circle cx="16" cy="16" r="10" stroke="#efeeea" strokeWidth="2.4" />
      <path d="M16 10.6l1.6 3.3 3.6.5-2.6 2.5.6 3.6-3.2-1.7-3.2 1.7.6-3.6-2.6-2.5 3.6-.5z" fill="#efeeea" />
    </svg>
  )
}

/** The star heartwood alone, for drawing over a photograph of log ends. */
export function StarHeart({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z" fill="#efeeea" />
    </svg>
  )
}
