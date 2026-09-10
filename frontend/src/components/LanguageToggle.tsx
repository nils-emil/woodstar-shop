import { useT } from '@/i18n'
import type { Locale } from '@/api/types'

export function LanguageToggle({ className = '', variant = 'light' }: { className?: string; variant?: 'light' | 'dark' }) {
  const { locale, setLocale, t } = useT()
  const opt = (l: Locale) => (
    <button
      key={l}
      onClick={() => setLocale(l)}
      aria-pressed={locale === l}
      className={`h-7 px-2.5 rounded-md text-xs font-bold uppercase tracking-wide transition-colors ${
        variant === 'dark'
          ? locale === l ? 'bg-white text-ink' : 'text-white/70 hover:bg-white/10'
          : locale === l ? 'bg-ink text-white' : 'text-ink-3 hover:bg-canvas'
      }`}
    >
      {l}
    </button>
  )
  return (
    <div className={`inline-flex gap-0.5 rounded-lg p-0.5 ${variant === 'dark' ? 'bg-white/10' : 'bg-white border border-line'} ${className}`} role="group" aria-label={t('language')}>
      {opt('et')}
      {opt('en')}
    </div>
  )
}
