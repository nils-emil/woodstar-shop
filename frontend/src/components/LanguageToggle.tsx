import { useT } from '@/i18n'
import type { Locale } from '@/api/types'

const names: Record<Locale, string> = { et: 'Eesti', en: 'English' }

/** Two plain words; the one in use is in full ink with the accent underline. */
export function LanguageToggle({ className = '', variant = 'light' }: { className?: string; variant?: 'light' | 'dark' }) {
  const { locale, setLocale, t } = useT()
  const dark = variant === 'dark'
  return (
    <div className={`inline-flex gap-4 ${className}`} role="group" aria-label={t('language')}>
      {(['et', 'en'] as const).map((l) => (
        <button
          key={l}
          lang={l}
          onClick={() => setLocale(l)}
          aria-pressed={locale === l}
          className={`small font-semibold underline decoration-[3px] underline-offset-[0.35em] transition-colors ${
            locale === l
              ? `${dark ? 'text-paper' : 'text-ink'} decoration-accent-600`
              : `${dark ? 'text-paper/80 hover:text-paper' : 'text-ink-3 hover:text-ink'} decoration-transparent`
          }`}
        >
          {names[l]}
        </button>
      ))}
    </div>
  )
}
