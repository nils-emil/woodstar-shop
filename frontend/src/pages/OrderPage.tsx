import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CheckCircle2, KeyRound, MapPin, CreditCard } from 'lucide-react'
import { api, isApiError } from '@/api/client'
import type { PublicOrder } from '@/api/types'
import { Alert } from '@/components/Alert'
import { formatDateTime, useT } from '@/i18n'

export function OrderPage() {
  const { id = '' } = useParams()
  const { t, locale } = useT()
  const [order, setOrder] = useState<PublicOrder | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [netError, setNetError] = useState(false)

  useEffect(() => {
    let cancelled = false
    let timer: number | undefined
    const tick = async () => {
      try {
        const o = await api.order(id)
        if (cancelled) return
        setOrder(o)
        setNetError(false)
        if (o.state === 'PENDING_PAYMENT') timer = window.setTimeout(tick, 2000)
      } catch (e) {
        if (cancelled) return
        if (isApiError(e) && e.status === 404) {
          setNotFound(true)
          return
        }
        setNetError(true)
        timer = window.setTimeout(tick, 3000)
      }
    }
    void tick()
    return () => {
      cancelled = true
      if (timer) window.clearTimeout(timer)
    }
  }, [id])

  if (notFound) return <Alert tone="error" className="mt-6">{t('orderNotFound')}</Alert>

  if (!order || order.state === 'PENDING_PAYMENT') {
    return (
      <div className="pt-16 fade-up">
        <div className="card rounded-2xl p-8 flex flex-col items-center text-center gap-5 overflow-hidden relative">
          <div className="progress-bar absolute top-0 left-0 right-0 h-1" />
          <span className="breathe grid place-items-center h-16 w-16 rounded-full bg-accent-50 text-accent-600">
            <CreditCard size={30} />
          </span>
          <div>
            <h1 className="text-xl font-bold text-ink">{t('waitingForPayment')}</h1>
            <p className="mt-2 text-sm text-ink-3 max-w-xs">{t('waitingHint')}</p>
          </div>
          {netError && <Alert tone="warning">{t('networkError')}</Alert>}
        </div>
      </div>
    )
  }

  if (order.state === 'EXPIRED') return <Alert tone="warning" className="mt-6">{t('orderExpired')}</Alert>
  if (order.state === 'CANCELLED') return <Alert tone="warning" className="mt-6">{t('orderCancelled')}</Alert>
  if (order.state === 'REFUNDED') return <Alert tone="warning" className="mt-6">{t('orderRefunded')}</Alert>

  return (
    <div className="space-y-5 pt-8">
      <div className="flex flex-col items-center text-center gap-2 fade-up" style={{ ['--i' as string]: 0 }}>
        <span className="grid place-items-center h-16 w-16 rounded-full bg-success-50 text-success-500 animate-pop-in">
          <CheckCircle2 size={36} />
        </span>
        <h1 className="text-2xl font-bold text-ink mt-1">{t('paymentReceived')}</h1>
        <p className="text-sm text-ink-3">
          {t('orderNumber')} <span className="font-mono font-semibold text-ink">{order.orderNumber}</span>
        </p>
      </div>

      <div className="card rounded-2xl fade-up" style={{ ['--i' as string]: 1 }}>
        <div className="p-5 flex items-center gap-5">
          <div className="grid place-items-center h-20 w-20 rounded-xl bg-accent-50 shrink-0">
            <span className="font-display text-4xl font-medium text-ink">{order.lockerLabel}</span>
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold text-accent-600 uppercase tracking-wide">{t('yourLocker')}</div>
            <div className="font-semibold text-ink mt-0.5">{order.productName}</div>
            <div className="flex items-start gap-1.5 text-sm text-ink-3 mt-1.5">
              <MapPin size={15} className="shrink-0 mt-0.5" />
              <span>{order.siteName}, {order.siteAddress}</span>
            </div>
          </div>
        </div>
        {order.pickupDeadline && (
          <div className="border-t border-line px-5 py-3 text-sm flex items-center justify-between">
            <span className="text-ink-3">{t('pickupBy')}</span>
            <span className="font-semibold text-ink">{formatDateTime(order.pickupDeadline, locale)}</span>
          </div>
        )}
      </div>

      {order.pickupToken && (
        <Link
          to={`/pickup/${order.pickupToken}`}
          className="btn-cta fade-up flex items-center justify-center gap-3 h-16 rounded-2xl text-lg font-bold"
          style={{ ['--i' as string]: 2 }}
        >
          <KeyRound size={22} />
          {t('goToPickup')}
        </Link>
      )}
      <p className="text-center text-sm text-ink-3 fade-up" style={{ ['--i' as string]: 3 }}>{t('pickupLinkSent')}</p>
    </div>
  )
}
