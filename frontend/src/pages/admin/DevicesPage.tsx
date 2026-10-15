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
        <div className="grid gap-1">
          {devices.data.map((d) => (
            <Card key={d.deviceId} className="flex items-center gap-4 px-5 py-4">
              <span className={`grid place-items-center h-11 w-11 shrink-0 ${d.online ? 'bg-success-50 text-success-700' : 'bg-danger-50 text-danger-700'}`}>
                {d.online ? <Wifi size={20} /> : <WifiOff size={20} />}
              </span>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-[17px] break-all">{d.deviceId}</div>
                <div className="text-[15px] text-ink-3">
                  {t('linkedLockers')}: {d.lockers.length ? d.lockers.map((l) => `${l.siteName} ${l.label}`).join(', ') : '–'}
                </div>
              </div>
              <Badge tone={d.online ? 'green' : 'red'}>{d.online ? t('online') : t('offline')}</Badge>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
