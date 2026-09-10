import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { et, type TranslationKey } from './et'
import { en } from './en'
import type { Locale } from '@/api/types'

const STORAGE_KEY = 'woodstar.lang'
const dictionaries: Record<Locale, Record<TranslationKey, string>> = { et, en }

function readStoredLocale(): Locale {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'en' || v === 'et') return v
  } catch {
    /* storage unavailable */
  }
  return 'et'
}

export type TFunction = (key: TranslationKey, params?: Record<string, string | number>) => string

interface I18nContextValue {
  locale: Locale
  setLocale: (l: Locale) => void
  t: TFunction
}

const I18nContext = createContext<I18nContextValue | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(readStoredLocale)

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l)
    try {
      localStorage.setItem(STORAGE_KEY, l)
    } catch {
      /* ignore */
    }
    document.documentElement.lang = l
  }, [])

  const t = useCallback<TFunction>(
    (key, params) => {
      let s: string = dictionaries[locale][key] ?? et[key] ?? key
      if (params) {
        for (const [k, v] of Object.entries(params)) s = s.replace(`{${k}}`, String(v))
      }
      return s
    },
    [locale],
  )

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useT() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useT must be used inside I18nProvider')
  return ctx
}

const eur = new Intl.NumberFormat('et-EE', { style: 'currency', currency: 'EUR' })
export function formatPrice(cents: number): string {
  return eur.format(cents / 100)
}

export function formatDateTime(iso: string | null | undefined, locale: Locale): string {
  if (!iso) return '–'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat(locale === 'et' ? 'et-EE' : 'en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

export function productName(p: { nameEt: string; nameEn: string }, locale: Locale): string {
  return locale === 'et' ? p.nameEt : p.nameEn
}

export function productDescription(
  p: { descriptionEt: string | null; descriptionEn: string | null },
  locale: Locale,
): string | null {
  return locale === 'et' ? p.descriptionEt : p.descriptionEn
}
