import { Wifi, WifiOff } from 'lucide-react'
import { admin } from '@/api/client'
import { Alert } from '@/components/Alert'
import { Badge } from '@/components/Badge'
import { Card } from '@/components/Card'
import { PageSpinner } from '@/components/Spinner'
import { useAsync } from '@/components/useAsync'
import { useT } from '@/i18n'
import { PageHeader } from './AdminLayout'

export function DevicesPage() {
  const { t } = useT()
  const devices = useAsync(() => admin.devices())

  return (
    <div>
      <PageHeader title={t('devices')} />
      {devices.error && <Alert tone="error" className="mb-4">{devices.error}</Alert>}
      {devices.loading && !devices.data ? (
        <PageSpinner />
      ) : !devices.data?.length ? (
        <Alert tone="info">{t('noDevices')}</Alert>
      ) : (
        <Card className="divide-y divide-wood-100">
          {devices.data.map((d) => (
            <div key={d.deviceId} className="flex items-center gap-3 px-4 py-3">
              <span className={`grid place-items-center h-10 w-10 rounded-xl ${d.online ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {d.online ? <Wifi size={20} /> : <WifiOff size={20} />}
              </span>
              <div className="flex-1 min-w-0">
                <div className="font-mono font-semibold break-all">{d.deviceId}</div>
                <div className="text-sm text-stone-500">
                  {t('linkedLockers')}: {d.lockers.length ? d.lockers.map((l) => `${l.siteName} ${l.label}`).join(', ') : '–'}
                </div>
              </div>
              <Badge tone={d.online ? 'green' : 'red'}>{d.online ? t('online') : t('offline')}</Badge>
            </div>
          ))}
        </Card>
      )}
    </div>
  )
}
