import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { api, isApiError } from '@/api/client'
import type { PublicOrder } from '@/api/types'
import { Alert } from '@/components/Alert'
import { formatDateTime, formatPrice, useT } from '@/i18n'

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

  if (notFound) return <Alert tone="error" className="mt-10">{t('orderNotFound')}</Alert>

  if (!order || order.state === 'PENDING_PAYMENT') {
    return (
      <div className="pt-16 grid gap-6 enter">
        <h1 className="head">{t('waitingForPayment')}</h1>
        <p className="lead max-w-[30ch]">{t('waitingHint')}</p>
        <div className="flex gap-1.5" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <span key={i} className="ticking block h-10 w-7 bg-ink" style={{ animationDelay: `${i * 200}ms` }} />
          ))}
        </div>
        {netError && <Alert tone="warning">{t('networkError')}</Alert>}
      </div>
    )
  }

  if (order.state === 'EXPIRED') return <Alert tone="warning" className="mt-10">{t('orderExpired')}</Alert>
  if (order.state === 'CANCELLED') return <Alert tone="warning" className="mt-10">{t('orderCancelled')}</Alert>
  if (order.state === 'REFUNDED') return <Alert tone="warning" className="mt-10">{t('orderRefunded')}</Alert>

  return (
    <div className="pt-10 grid gap-8">
      <h1 className="head enter">{t('paymentReceived')}</h1>

      <div className="bg-paper p-6 enter" style={{ ['--i' as string]: 1 }}>
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="font-semibold">{t('yourLocker')}</p>
            <p className="display text-[7rem]">{order.lockerLabel}</p>
          </div>
          <p className="pb-3 text-right font-semibold">
            {t('orderNumber')}
            <br />
            {order.orderNumber}
          </p>
        </div>
        <dl className="mt-6 grid gap-3 m-0">
          <ReceiptRow what={order.productName} value={formatPrice(order.priceCents)} />
          <ReceiptRow what={order.siteName} value={order.siteAddress} />
          {order.pickupDeadline && (
            <ReceiptRow what={t('pickupBy')} value={formatDateTime(order.pickupDeadline, locale)} />
          )}
        </dl>
      </div>

      {order.pickupToken && (
        <Link
          to={`/pickup/${order.pickupToken}`}
          className="btn btn-accent !min-h-16 !text-xl justify-between enter"
          style={{ ['--i' as string]: 2 }}
        >
          {t('goToPickup')}
          <ArrowRight size={24} aria-hidden="true" />
        </Link>
      )}
      <p className="enter" style={{ ['--i' as string]: 3 }}>{t('pickupLinkSent')}</p>
    </div>
  )
}

function ReceiptRow({ what, value }: { what: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt>{what}</dt>
      <dd className="m-0 font-semibold text-right">{value}</dd>
    </div>
  )
}
