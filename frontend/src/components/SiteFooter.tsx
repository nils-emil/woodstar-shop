import { useT } from '@/i18n'

const MAIL_FROM = 'noreply@woodstar.ee'

export function SiteFooter() {
  const { t } = useT()
  return (
    <footer className="bg-surface">
      <div className="mx-auto max-w-6xl px-4 py-8 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="small">
          © {new Date().getFullYear()} {t('appName')} · {t('footerStatement')}
        </p>
        <p className="small">
          {t('footerLostLink')} <span className="font-semibold">{MAIL_FROM}</span>
        </p>
      </div>
    </footer>
  )
}
