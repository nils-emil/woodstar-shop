import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Check, DoorOpen, MapPin, WifiOff } from 'lucide-react'
import { api, isApiError } from '@/api/client'
import type { CannotOpenReason, PickupInfo } from '@/api/types'
import { Alert } from '@/components/Alert'
import { Button } from '@/components/Button'
import { Spinner, PageSpinner } from '@/components/Spinner'
import { errorMessage, useAsync } from '@/components/useAsync'
import { formatDateTime, useT, type TFunction } from '@/i18n'

function reasonText(reason: CannotOpenReason | string, t: TFunction): string {
  switch (reason) {
    case 'NOT_PAID':
      return t('reasonNotPaid')
    case 'EXPIRED':
      return t('reasonExpired')
    case 'REOPEN_WINDOW_CLOSED':
      return t('reasonReopenWindowClosed')
    case 'TOO_MANY_OPENS':
      return t('reasonTooManyOpens')
    case 'DEVICE_UNREACHABLE':
      return t('deviceUnreachable')
    default:
      return t('error')
  }
}

/** Small locker door swinging open to reveal a checkmark. */
function DoorAnimation({ label }: { label: string }) {
  return (
    <div className="relative mx-auto h-28 w-28 door-scene">
      <div className="absolute inset-0 rounded-xl bg-success-50 border border-success-500/30 grid place-items-center">
        <span className="door-inside grid place-items-center h-12 w-12 rounded-full bg-success-500 text-white">
          <Check size={28} strokeWidth={3} />
        </span>
      </div>
      <div className="door absolute inset-0 rounded-xl bg-white border border-line shadow-card grid place-items-center">
        <span className="font-display text-4xl font-medium text-ink">{label}</span>
        <span className="absolute right-3 top-1/2 -translate-y-1/2 h-6 w-1.5 rounded-full bg-line-strong" />
      </div>
    </div>
  )
}

export function PickupPage() {
  const { token = '' } = useParams()
  const { t, locale } = useT()
  const info = useAsync(() => api.pickup(token), [token])
  const [opening, setOpening] = useState(false)
  const [opened, setOpened] = useState(false)
  const [openError, setOpenError] = useState<{ text: string; retryable: boolean } | null>(null)

  const open = async () => {
    setOpening(true)
    setOpenError(null)
    try {
      const res = await api.pickupOpen(token)
      setOpened(true)
      info.setData(info.data ? { ...info.data, opensRemaining: res.opensRemaining, state: 'PICKED_UP' } : info.data)
      void info.reload()
    } catch (e) {
      if (isApiError(e)) {
        const retryable = e.status === 503 || e.status === 0
        setOpenError({ text: retryable ? t('deviceUnreachable') : reasonText(e.code, t), retryable })
        if (!retryable) void info.reload()
      } else {
        setOpenError({ text: errorMessage(e, t('networkError')), retryable: true })
      }
    } finally {
      setOpening(false)
    }
  }

  if (info.loading && !info.data) return <PageSpinner />
  if (!info.data) {
    return info.errorCode === 'HTTP_404' || info.errorCode === 'NOT_FOUND' ? (
      <Alert tone="error" className="mt-6">{t('pickupNotFound')}</Alert>
    ) : (
      <div className="space-y-3 pt-6">
        <Alert tone="error">{t('networkError')}</Alert>
        <Button variant="secondary" onClick={() => void info.reload()}>{t('retry')}</Button>
      </div>
    )
  }

  const d: PickupInfo = info.data
  const canOpen = d.canOpen || opened
  const finished = !d.canOpen && d.state === 'PICKED_UP' && !opened

  return (
    <div className="space-y-5 pt-6">
      <div className="fade-up" style={{ ['--i' as string]: 0 }}>
        <p className="text-sm font-semibold text-accent-600 mb-1">{t('locker')}</p>
        <div className="flex items-end justify-between gap-4">
          <h1 className="font-display text-[4.5rem] leading-none font-medium text-ink">{d.lockerLabel}</h1>
          <div className="text-right pb-2">
            <div className="font-semibold text-ink">{d.productName}</div>
            <div className="text-xs text-ink-4 font-mono mt-0.5">{d.orderNumber}</div>
          </div>
        </div>
      </div>

      <div className="card rounded-2xl divide-y divide-line fade-up" style={{ ['--i' as string]: 1 }}>
        <div className="flex items-start gap-3 px-4 py-3.5">
          <MapPin size={18} className="shrink-0 text-accent-600 mt-0.5" />
          <div className="text-sm">
            <div className="font-semibold text-ink">{d.siteName}</div>
            <div className="text-ink-3">{d.siteAddress}</div>
          </div>
        </div>
        {d.pickupDeadline && d.state === 'PAID' && (
          <div className="px-4 py-3 text-sm flex items-center justify-between">
            <span className="text-ink-3">{t('pickupBy')}</span>
            <span className="font-semibold text-ink">{formatDateTime(d.pickupDeadline, locale)}</span>
          </div>
        )}
      </div>

      {!d.deviceOnline && canOpen && !opened && (
        <Alert tone="warning" className="fade-up">
          <span className="flex items-center gap-2"><WifiOff size={16} /> {t('deviceOffline')}</span>
        </Alert>
      )}

      {opened && (
        <div className="card rounded-2xl p-6 flex flex-col items-center text-center gap-3 animate-pop-in">
          <DoorAnimation label={d.lockerLabel} />
          <h2 className="text-xl font-bold text-ink mt-1">{t('doorOpened')}</h2>
          <p className="text-sm text-ink-3 max-w-xs">{t('doorOpenedHint')}</p>
        </div>
      )}

      {openError && <Alert tone="error">{openError.text}</Alert>}

      {canOpen ? (
        <div className="space-y-3 fade-up" style={{ ['--i' as string]: 2 }}>
          <button
            onClick={() => void open()}
            disabled={opening}
            className={`w-full h-24 rounded-2xl flex items-center justify-center gap-3 text-2xl font-bold select-none transition-transform active:scale-[0.99] disabled:cursor-wait focus:outline-none focus-visible:ring-4 focus-visible:ring-accent-300 ${
              opened ? 'card text-ink' : 'btn-cta pulse-soft'
            }`}
          >
            {opening ? <Spinner size={32} /> : <DoorOpen size={34} strokeWidth={1.75} />}
            {opening ? t('opening') : opened ? t('openAgain') : t('openLocker')}
          </button>
          <p className="text-center text-sm text-ink-3">
            {opened ? t('opensRemaining', { n: d.opensRemaining }) : t('standInFront')}
          </p>
        </div>
      ) : finished ? (
        <Alert tone="success">{t('alreadyPickedUp')}</Alert>
      ) : (
        <Alert tone="warning">{d.cannotOpenReason ? reasonText(d.cannotOpenReason, t) : t('error')}</Alert>
      )}
    </div>
  )
}
