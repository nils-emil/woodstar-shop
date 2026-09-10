import { useEffect, useState } from 'react'
import { Mail, XCircle } from 'lucide-react'
import { admin } from '@/api/client'
import type { AdminOrder, AdminOrderDetail, OrderState } from '@/api/types'
import { Alert } from '@/components/Alert'
import { Badge, orderStateTone } from '@/components/Badge'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { ConfirmDialog, Drawer } from '@/components/Modal'
import { Select } from '@/components/Select'
import { PageSpinner } from '@/components/Spinner'
import { errorMessage, useAsync } from '@/components/useAsync'
import { formatDateTime, formatPrice, useT } from '@/i18n'
import { PageHeader } from './AdminLayout'

const STATES: OrderState[] = ['PENDING_PAYMENT', 'PAID', 'PICKED_UP', 'EXPIRED', 'CANCELLED', 'REFUNDED']

function isOverdue(o: AdminOrder): boolean {
  return o.state === 'PAID' && !!o.pickupDeadline && new Date(o.pickupDeadline).getTime() < Date.now()
}

export function OrdersPage() {
  const { t, locale } = useT()
  const sites = useAsync(() => admin.sites())
  const [state, setState] = useState<OrderState | ''>('')
  const [siteId, setSiteId] = useState('')
  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const orders = useAsync(() => admin.orders({ state, siteId, q: debouncedQ }), [state, siteId, debouncedQ])
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    const h = window.setTimeout(() => setDebouncedQ(q.trim()), 300)
    return () => window.clearTimeout(h)
  }, [q])

  return (
    <div>
      <PageHeader title={t('orders')} />
      <div className="grid sm:grid-cols-3 gap-3 mb-5">
        <Select label={t('status')} value={state} onChange={(e) => setState(e.target.value as OrderState | '')}>
          <option value="">{t('all')}</option>
          {STATES.map((s) => (
            <option key={s} value={s}>{t(`state_${s}`)}</option>
          ))}
        </Select>
        <Select label={t('site')} value={siteId} onChange={(e) => setSiteId(e.target.value)}>
          <option value="">{t('all')}</option>
          {(sites.data ?? []).map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </Select>
        <Input label={t('search')} name="q" placeholder={t('searchOrders')} value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {orders.error && <Alert tone="error" className="mb-4">{orders.error}</Alert>}
      {orders.loading && !orders.data ? (
        <PageSpinner />
      ) : !orders.data?.length ? (
        <Alert tone="info">{t('noOrders')}</Alert>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-wood-200/70 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-wood-50 text-left text-xs uppercase tracking-wide text-wood-700">
              <tr>
                <th className="px-3 py-2.5">{t('orderNumber')}</th>
                <th className="px-3 py-2.5">{t('status')}</th>
                <th className="px-3 py-2.5">{t('site')}</th>
                <th className="px-3 py-2.5">{t('locker')}</th>
                <th className="px-3 py-2.5">{t('product')}</th>
                <th className="px-3 py-2.5 text-right">{t('price')}</th>
                <th className="px-3 py-2.5">{t('customer')}</th>
                <th className="px-3 py-2.5">{t('created')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-wood-100">
              {orders.data.map((o) => (
                <tr key={o.id} onClick={() => setSelectedId(o.id)} className="cursor-pointer hover:bg-wood-50">
                  <td className="px-3 py-2.5 font-mono font-semibold whitespace-nowrap">{o.orderNumber}</td>
                  <td className="px-3 py-2.5">
                    <Badge tone={orderStateTone[o.state]}>{t(`state_${o.state}`)}</Badge>
                    {isOverdue(o) && <Badge tone="red" className="ml-1">{t('overdue')}</Badge>}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">{o.siteName}</td>
                  <td className="px-3 py-2.5 font-bold">{o.lockerLabel}</td>
                  <td className="px-3 py-2.5">{o.productName}</td>
                  <td className="px-3 py-2.5 text-right whitespace-nowrap">{formatPrice(o.priceCents)}</td>
                  <td className="px-3 py-2.5">
                    <div>{o.email}</div>
                    {o.phone && <div className="text-stone-500">{o.phone}</div>}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-stone-500">{formatDateTime(o.createdAt, locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <OrderDrawer id={selectedId} onClose={() => setSelectedId(null)} onChanged={() => void orders.reload()} />
    </div>
  )
}

function OrderDrawer({ id, onClose, onChanged }: { id: string | null; onClose: () => void; onChanged: () => void }) {
  const { t, locale } = useT()
  const [order, setOrder] = useState<AdminOrderDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [confirm, setConfirm] = useState(false)

  useEffect(() => {
    setOrder(null)
    setMsg(null)
    setError(null)
    if (!id) return
    admin.order(id).then(setOrder).catch((e) => setError(errorMessage(e, t('networkError'))))
  }, [id, t])

  if (!id) return null

  const reload = () => admin.order(id).then(setOrder).catch(() => undefined)

  const cancel = async () => {
    setConfirm(false)
    setBusy('cancel')
    setMsg(null)
    try {
      await admin.cancelOrder(id)
      await reload()
      onChanged()
    } catch (e) {
      setMsg({ tone: 'error', text: errorMessage(e, t('networkError')) })
    } finally {
      setBusy(null)
    }
  }

  const resend = async () => {
    setBusy('resend')
    setMsg(null)
    try {
      await admin.resendEmail(id)
      setMsg({ tone: 'success', text: t('emailSent') })
    } catch (e) {
      setMsg({ tone: 'error', text: errorMessage(e, t('networkError')) })
    } finally {
      setBusy(null)
    }
  }

  const cancellable = order && (order.state === 'PENDING_PAYMENT' || order.state === 'PAID')
  const resendable = order && (order.state === 'PAID' || order.state === 'PICKED_UP')

  return (
    <Drawer open={!!id} onClose={onClose} title={order ? order.orderNumber : t('orderDetails')}>
      {error ? (
        <Alert tone="error">{error}</Alert>
      ) : !order ? (
        <PageSpinner />
      ) : (
        <div className="space-y-5">
          <div className="flex gap-2 flex-wrap">
            <Badge tone={orderStateTone[order.state]}>{t(`state_${order.state}`)}</Badge>
            {isOverdue(order) && <Badge tone="red">{t('overdue')}</Badge>}
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
            <dt className="text-stone-500">{t('site')}</dt><dd className="font-semibold">{order.siteName}</dd>
            <dt className="text-stone-500">{t('locker')}</dt><dd className="font-bold">{order.lockerLabel}</dd>
            <dt className="text-stone-500">{t('product')}</dt><dd>{order.productName}</dd>
            <dt className="text-stone-500">{t('price')}</dt><dd>{formatPrice(order.priceCents)}</dd>
            <dt className="text-stone-500">{t('email')}</dt><dd className="break-all">{order.email}</dd>
            <dt className="text-stone-500">{t('phone')}</dt><dd>{order.phone ?? '–'}</dd>
            <dt className="text-stone-500">{t('created')}</dt><dd>{formatDateTime(order.createdAt, locale)}</dd>
            <dt className="text-stone-500">{t('paid')}</dt><dd>{formatDateTime(order.paidAt, locale)}</dd>
            <dt className="text-stone-500">{t('deadline')}</dt><dd>{formatDateTime(order.pickupDeadline, locale)}</dd>
            <dt className="text-stone-500">{t('pickedUp')}</dt><dd>{formatDateTime(order.pickedUpAt, locale)}</dd>
            <dt className="text-stone-500">{t('openCount')}</dt><dd>{order.openCount}</dd>
          </dl>

          {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}

          <div className="space-y-2">
            {resendable && (
              <Button variant="secondary" full icon={<Mail size={18} />} loading={busy === 'resend'} onClick={() => void resend()}>
                {t('resendEmail')}
              </Button>
            )}
            {cancellable && (
              <Button variant="danger" full icon={<XCircle size={18} />} loading={busy === 'cancel'} onClick={() => setConfirm(true)}>
                {t('cancelOrder')}
              </Button>
            )}
          </div>

          <div>
            <h3 className="text-sm font-bold uppercase tracking-wide text-wood-600 mb-2">{t('events')}</h3>
            {order.events?.length ? (
              <ul className="divide-y divide-wood-100 text-sm">
                {order.events.map((e) => (
                  <li key={e.id} className="py-2">
                    <div className="flex justify-between gap-2">
                      <span className={`font-semibold ${e.type === 'OPEN_FAILED' ? 'text-red-700' : ''}`}>{t(`event_${e.type}`)}</span>
                      <span className="text-stone-400 whitespace-nowrap">{formatDateTime(e.createdAt, locale)}</span>
                    </div>
                    {e.detail && <div className="text-stone-500 break-words">{e.detail}</div>}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-sm text-stone-400">{t('noEvents')}</div>
            )}
          </div>
        </div>
      )}
      <ConfirmDialog
        open={confirm}
        title={t('cancelOrder')}
        message={t('cancelOrderConfirm', { number: order?.orderNumber ?? '' })}
        confirmLabel={t('cancelOrder')}
        danger
        onClose={() => setConfirm(false)}
        onConfirm={() => void cancel()}
      />
    </Drawer>
  )
}
