/** Three stacked log ends, drawn to match lucide's 2px stroke style. */
export function LogsIcon({ size = 24, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="12" cy="7.5" r="4" />
      <circle cx="7.5" cy="16" r="4" />
      <circle cx="16.5" cy="16" r="4" />
      <circle cx="12" cy="7.5" r="1" />
      <circle cx="7.5" cy="16" r="1" />
      <circle cx="16.5" cy="16" r="1" />
    </svg>
  )
}
