import { Link, Outlet, useLocation } from 'react-router-dom'
import { LanguageToggle } from '@/components/LanguageToggle'
import { Logo } from '@/components/Logo'
import { SiteFooter } from '@/components/SiteFooter'
import { useT } from '@/i18n'

export function PublicLayout() {
  const { t } = useT()
  const { pathname } = useLocation()
  // The shop gets a wider two-column page; order and pickup pages stay phone-width.
  const wide = pathname === '/'
  return (
    <div className="min-h-dvh flex flex-col">
      <header className={`mx-auto w-full ${wide ? 'max-w-6xl' : 'max-w-xl'} px-4 py-5 flex items-center justify-between gap-4`}>
        <Link to="/" className="flex items-center gap-2.5 text-ink" aria-label={t('appName')}>
          <Logo size={30} />
          <span className="wordmark">{t('appName')}</span>
        </Link>
        <LanguageToggle />
      </header>
      <main className={`flex-1 mx-auto w-full ${wide ? 'max-w-6xl' : 'max-w-xl'} px-4 pb-16`}>
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  )
}
