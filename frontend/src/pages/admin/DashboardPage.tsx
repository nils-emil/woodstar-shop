import { AlertTriangle, Clock, ShoppingBag, Wallet, WifiOff, CheckCircle2 } from 'lucide-react'
import { admin } from '@/api/client'
import { Alert } from '@/components/Alert'
import { Card, CardBody } from '@/components/Card'
import { PageSpinner } from '@/components/Spinner'
import { useAsync } from '@/components/useAsync'
import { formatPrice, useT } from '@/i18n'
import { PageHeader } from './AdminLayout'
import type { ReactNode } from 'react'

function Stat({ icon, label, value, tone = 'wood' }: { icon: ReactNode; label: string; value: string | number; tone?: 'wood' | 'red' | 'green' }) {
  const colors = { wood: 'bg-wood-100 text-wood-700', red: 'bg-red-100 text-red-700', green: 'bg-green-100 text-green-700' }
  return (
    <Card>
      <CardBody className="flex items-center gap-4">
        <span className={`grid place-items-center h-12 w-12 rounded-xl ${colors[tone]}`}>{icon}</span>
        <div>
          <div className="text-2xl font-extrabold text-wood-900">{value}</div>
          <div className="text-sm text-stone-500">{label}</div>
        </div>
      </CardBody>
    </Card>
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
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat icon={<ShoppingBag />} label={t('ordersToday')} value={dash.data.ordersToday} />
            <Stat icon={<Wallet />} label={t('revenueToday')} value={formatPrice(dash.data.revenueTodayCents)} />
            <Stat icon={<Clock />} label={t('awaitingPickup')} value={dash.data.paidAwaitingPickup} />
            <Stat icon={<AlertTriangle />} label={t('overduePickups')} value={dash.data.overduePickups} tone={dash.data.overduePickups > 0 ? 'red' : 'wood'} />
          </div>

          <div>
            <h2 className="text-lg font-bold text-wood-900 mb-3">{t('sites')}</h2>
            <div className="grid md:grid-cols-2 gap-3">
              {dash.data.sites.map((s) => (
                <Card key={s.siteId}>
                  <CardBody>
                    <div className="flex items-center justify-between mb-3">
                      <div className="font-bold text-lg">{s.siteName}</div>
                      {s.offlineDevices > 0 ? (
                        <span className="flex items-center gap-1 text-sm font-semibold text-red-700"><WifiOff size={16} /> {s.offlineDevices} {t('offlineDevices')}</span>
                      ) : (
                        <span className="flex items-center gap-1 text-sm font-semibold text-green-700"><CheckCircle2 size={16} /> {t('allDevicesOnline')}</span>
                      )}
                    </div>
                    <div className="grid grid-cols-5 gap-1 text-center">
                      {[
                        [s.stocked, t('stockedCount'), 'bg-green-100 text-green-800'],
                        [s.reserved, t('reservedCount'), 'bg-amber-100 text-amber-800'],
                        [s.sold, t('soldCount'), 'bg-sky-100 text-sky-800'],
                        [s.empty, t('emptyCount'), 'bg-stone-100 text-stone-700'],
                        [s.outOfOrder, t('outOfOrderCount'), 'bg-red-100 text-red-800'],
                      ].map(([n, label, cls], i) => (
                        <div key={i} className={`rounded-lg py-2 ${cls}`}>
                          <div className="text-xl font-extrabold">{n}</div>
                          <div className="text-[11px] font-semibold leading-tight">{label}</div>
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
