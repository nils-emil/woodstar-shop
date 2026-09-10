import { Link, Outlet } from 'react-router-dom'
import { Backdrop } from '@/components/Backdrop'
import { LanguageToggle } from '@/components/LanguageToggle'
import { Logo } from '@/components/Logo'
import { useT } from '@/i18n'

export function PublicLayout() {
  const { t } = useT()
  return (
    <div className="relative min-h-dvh flex flex-col">
      <Backdrop />
      <header className="relative z-20 sticky top-0 bg-canvas/80 backdrop-blur-md border-b border-line/70">
        <div className="mx-auto max-w-lg px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 text-ink" aria-label={t('appName')}>
            <Logo size={32} />
            <span className="text-[1.15rem] font-bold tracking-tight">{t('appName')}</span>
          </Link>
          <LanguageToggle />
        </div>
      </header>
      <main className="relative z-10 flex-1 mx-auto w-full max-w-lg px-4 pb-12">
        <Outlet />
      </main>
      <footer className="relative z-10 py-8 text-center text-xs text-ink-4">
        © {new Date().getFullYear()} {t('appName')} · {t('footerNote')}
      </footer>
    </div>
  )
}
