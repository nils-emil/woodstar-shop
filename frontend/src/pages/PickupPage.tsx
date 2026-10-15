import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Check, DoorOpen, WifiOff } from 'lucide-react'
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

/** The door swings open on its hinge to show the empty, green inside. */
function DoorSwing({ label }: { label: string }) {
  return (
    <div className="relative h-40 w-32 door-scene" aria-hidden="true">
      <div className="absolute inset-0 bg-success-500 grid place-items-center text-white door-inside">
        <Check size={44} strokeWidth={3} />
      </div>
      <div className="door-swing absolute inset-0 bg-surface grid place-items-center">
        <span className="display text-6xl">{label}</span>
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
      <Alert tone="error" className="mt-10">{t('pickupNotFound')}</Alert>
    ) : (
      <div className="space-y-4 pt-10">
        <Alert tone="error">{t('networkError')}</Alert>
        <Button variant="secondary" onClick={() => void info.reload()}>{t('retry')}</Button>
      </div>
    )
  }

  const d: PickupInfo = info.data
  const canOpen = d.canOpen || opened
  const finished = !d.canOpen && d.state === 'PICKED_UP' && !opened

  return (
    <div className="pt-4 grid gap-5">
      {/* the panel is the locker door itself */}
      <section className="door-panel enter" aria-labelledby="door-label">
        <div className="flex items-start justify-between gap-4">
          <p className="font-semibold">{t('locker')}</p>
          <p className="font-semibold text-right">{d.orderNumber}</p>
        </div>
        <h1 id="door-label" className="display door-label">{d.lockerLabel}</h1>
        <div className="grid gap-1 lead font-semibold pr-6">
          <span>{d.productName}</span>
          <span>{d.siteName}</span>
          <span className="text-ink-3">{d.siteAddress}</span>
          {d.pickupDeadline && d.state === 'PAID' && (
            <span className="text-ink-3">{t('pickupBy')} {formatDateTime(d.pickupDeadline, locale)}</span>
          )}
        </div>
      </section>

      {!d.deviceOnline && canOpen && !opened && (
        <Alert tone="warning">
          <span className="flex items-center gap-2"><WifiOff size={18} /> {t('deviceOffline')}</span>
        </Alert>
      )}

      {opened && (
        <div className="bg-paper p-6 flex items-center gap-6 enter">
          <DoorSwing label={d.lockerLabel} />
          <div className="grid gap-2">
            <h2 className="text-3xl font-extrabold tracking-[-0.04em] leading-none">{t('doorOpened')}</h2>
            <p>{t('doorOpenedHint')}</p>
          </div>
        </div>
      )}

      {openError && <Alert tone="error">{openError.text}</Alert>}

      {canOpen ? (
        <div className="grid gap-3 enter" style={{ ['--i' as string]: 1 }}>
          <button
            onClick={() => void open()}
            disabled={opening}
            className={`btn w-full !min-h-24 !text-3xl !font-extrabold tracking-[-0.03em] disabled:cursor-wait ${
              opened ? 'btn-tone' : 'btn-accent'
            }`}
          >
            {opening ? <Spinner size={32} /> : <DoorOpen size={36} strokeWidth={2} aria-hidden="true" />}
            {opening ? t('opening') : opened ? t('openAgain') : t('openLocker')}
          </button>
          <p className="text-center">{opened ? t('opensRemaining', { n: d.opensRemaining }) : t('standInFront')}</p>
        </div>
      ) : finished ? (
        <Alert tone="success">{t('alreadyPickedUp')}</Alert>
      ) : (
        <Alert tone="warning">{d.cannotOpenReason ? reasonText(d.cannotOpenReason, t) : t('error')}</Alert>
      )}
    </div>
  )
}
