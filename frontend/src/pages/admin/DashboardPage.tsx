import { AlertTriangle, Clock, ShoppingBag, Wallet, WifiOff, CheckCircle2 } from 'lucide-react'
import { admin } from '@/api/client'
import { Alert } from '@/components/Alert'
import { Card, CardBody } from '@/components/Card'
import { PageSpinner } from '@/components/Spinner'
import { useAsync } from '@/components/useAsync'
import { formatPrice, useT } from '@/i18n'
import { PageHeader } from './AdminLayout'
import type { ReactNode } from 'react'

function Stat({ icon, label, value, tone = 'neutral' }: { icon: ReactNode; label: string; value: string | number; tone?: 'neutral' | 'red' }) {
  const colors = { neutral: 'bg-paper text-ink', red: 'bg-danger-50 text-danger-700' }
  return (
    <div className={`p-5 sm:p-6 flex flex-col justify-between gap-6 min-h-36 ${colors[tone]}`}>
      <div className="flex items-start justify-between gap-3">
        <span className="text-[16px] font-semibold">{label}</span>
        <span className="shrink-0 opacity-80">{icon}</span>
      </div>
      <div className="text-4xl md:text-5xl font-extrabold tracking-[-0.05em] leading-none">{value}</div>
    </div>
  )
}

export function DashboardPage() {
  const { t } = useT()
  const dash = useAsync(() => admin.dashboard())

  return (
    <div>
      <PageHeader title={t('dashboard')} />
      {dash.loading && !dash.data ? (
        <PageSpinner />
      ) : !dash.data ? (
        <Alert tone="error">{dash.error ?? t('error')}</Alert>
      ) : (
        <div className="space-y-12">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            <Stat icon={<ShoppingBag />} label={t('ordersToday')} value={dash.data.ordersToday} />
            <Stat icon={<Wallet />} label={t('revenueToday')} value={formatPrice(dash.data.revenueTodayCents)} />
            <Stat icon={<Clock />} label={t('awaitingPickup')} value={dash.data.paidAwaitingPickup} />
            <Stat icon={<AlertTriangle />} label={t('overduePickups')} value={dash.data.overduePickups} tone={dash.data.overduePickups > 0 ? 'red' : 'neutral'} />
          </div>

          <div>
            <h2 className="text-3xl font-extrabold text-ink tracking-[-0.04em] mb-4">{t('sites')}</h2>
            <div className="grid md:grid-cols-2 gap-2">
              {dash.data.sites.map((s) => (
                <Card key={s.siteId}>
                  <CardBody>
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-5">
                      <div className="font-extrabold text-2xl tracking-[-0.03em]">{s.siteName}</div>
                      {s.offlineDevices > 0 ? (
                        <span className="flex items-center gap-1.5 text-[15px] font-semibold text-danger-700"><WifiOff size={16} /> {s.offlineDevices} {t('offlineDevices')}</span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-[15px] font-semibold text-success-700"><CheckCircle2 size={16} /> {t('allDevicesOnline')}</span>
                      )}
                    </div>
                    <div className="grid grid-cols-5 gap-1">
                      {[
                        [s.stocked, t('stockedCount'), 'bg-success-50 text-success-700'],
                        [s.reserved, t('reservedCount'), 'bg-warn-50 text-warn-700'],
                        [s.sold, t('soldCount'), 'bg-accent-50 text-accent-800'],
                        [s.empty, t('emptyCount'), 'bg-surface text-ink'],
                        [s.outOfOrder, t('outOfOrderCount'), 'bg-danger-50 text-danger-700'],
                      ].map(([n, label, cls], i) => (
                        <div key={i} className={`px-2 py-3 ${cls}`}>
                          <div className="text-2xl font-extrabold tracking-[-0.04em]">{n}</div>
                          <div className="text-[13px] font-semibold leading-tight">{label}</div>
                        </div>
                      ))}
                    </div>
                  </CardBody>
                </Card>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
