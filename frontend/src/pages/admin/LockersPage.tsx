import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { DoorOpen, Plus, Wifi, WifiOff } from 'lucide-react'
import { admin } from '@/api/client'
import type { AdminLocker, AdminProduct, AdminSite, LockerEvent, LockerInput, LockerState } from '@/api/types'
import { Alert } from '@/components/Alert'
import { Badge, lockerStateTone } from '@/components/Badge'
import { Button } from '@/components/Button'
import { Input, Textarea } from '@/components/Input'
import { ConfirmDialog, Drawer, Modal } from '@/components/Modal'
import { Select } from '@/components/Select'
import { PageSpinner } from '@/components/Spinner'
import { errorMessage, useAsync } from '@/components/useAsync'
import { formatDateTime, productName, useT } from '@/i18n'
import { PageHeader } from './AdminLayout'

const tileColors: Record<LockerState, string> = {
  EMPTY: 'bg-paper text-ink hover:bg-surface',
  STOCKED: 'bg-success-50 text-success-700 hover:bg-[#c6d6c2]',
  RESERVED: 'bg-warn-50 text-warn-700 hover:bg-[#e3d2ab]',
  SOLD: 'bg-accent-50 text-accent-800 hover:bg-accent-100',
  OUT_OF_ORDER: 'bg-danger-50 text-danger-700 hover:bg-[#e6c1bc]',
}

const emptyInput = (siteId: string): LockerInput => ({
  siteId,
  label: '',
  shellyDeviceId: '',
  relayChannel: 0,
  pulseSeconds: 2,
  note: null,
})

export function LockersPage() {
  const { t } = useT()
  const sites = useAsync(() => admin.sites())
  const products = useAsync(() => admin.products())
  const [siteId, setSiteId] = useState<string>('')
  const lockers = useAsync(() => (siteId ? admin.lockers(siteId) : Promise.resolve([] as AdminLocker[])), [siteId])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<AdminLocker | null>(null)

  useEffect(() => {
    if (sites.data?.length && !siteId) setSiteId(sites.data[0]!.id)
  }, [sites.data, siteId])

  const selected = lockers.data?.find((l) => l.id === selectedId) ?? null
  const sorted = useMemo(
    () => [...(lockers.data ?? [])].sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true })),
    [lockers.data],
  )

  return (
    <div>
      <PageHeader title={t('lockers')}>
        <Button variant="cta" icon={<Plus size={18} />} onClick={() => { setEditing(null); setFormOpen(true) }} disabled={!siteId}>
          {t('addLocker')}
        </Button>
      </PageHeader>

      {sites.data && sites.data.length > 1 && (
        <div className="max-w-xs mb-8">
          <Select label={t('site')} value={siteId} onChange={(e) => setSiteId(e.target.value)}>
            {sites.data.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </Select>
        </div>
      )}

      {lockers.error && <Alert tone="error" className="mb-4">{lockers.error}</Alert>}
      {lockers.loading && !lockers.data ? (
        <PageSpinner />
      ) : sorted.length === 0 ? (
        <Alert tone="info">{t('noLockers')}</Alert>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
          {sorted.map((l) => (
            <button
              key={l.id}
              onClick={() => setSelectedId(l.id)}
              className={`relative text-left p-4 min-h-36 flex flex-col transition-[background-color,transform] duration-150 active:translate-y-px ${tileColors[l.state]}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-4xl font-extrabold tracking-[-0.05em] leading-none">{l.label}</span>
                <span title={l.online ? t('online') : t('offline')} className={l.online ? 'text-success-700' : 'text-danger-700'}>
                  {l.online ? <Wifi size={16} /> : <WifiOff size={16} />}
                </span>
              </div>
              <div className="text-[15px] font-semibold mt-2">{t(`locker_${l.state}`)}</div>
              <div className="text-[15px] mt-auto pt-3 truncate">{l.productName ?? t('noProduct')}</div>
            </button>
          ))}
        </div>
      )}

      <LockerDrawer
        locker={selected}
        products={products.data ?? []}
        sites={sites.data ?? []}
        onClose={() => setSelectedId(null)}
        onChanged={(u) => lockers.setData((lockers.data ?? []).map((l) => (l.id === u.id ? u : l)))}
        onEdit={() => { if (selected) { setEditing(selected); setFormOpen(true) } }}
      />

      <LockerForm
        open={formOpen}
        siteId={siteId}
        sites={sites.data ?? []}
        locker={editing}
        onClose={() => setFormOpen(false)}
        onSaved={async () => { setFormOpen(false); await lockers.reload() }}
      />
    </div>
  )
}

function LockerDrawer({
  locker,
  products,
  sites,
  onClose,
  onChanged,
  onEdit,
}: {
  locker: AdminLocker | null
  products: AdminProduct[]
  sites: AdminSite[]
  onClose: () => void
  onChanged: (l: AdminLocker) => void
  onEdit: () => void
}) {
  const { t, locale } = useT()
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const [stockProduct, setStockProduct] = useState('')
  const [confirm, setConfirm] = useState<'open' | 'soldEmpty' | 'soldStock' | null>(null)
  const [events, setEvents] = useState<LockerEvent[] | null>(null)

  useEffect(() => {
    setMsg(null)
    setEvents(null)
    setStockProduct(locker?.productId ?? products.find((p) => p.active)?.id ?? products[0]?.id ?? '')
    if (locker) {
      admin.lockerEvents(locker.id).then(setEvents).catch(() => setEvents([]))
    }
  }, [locker?.id, products])

  if (!locker) return null

  const run = async (key: string, fn: () => Promise<AdminLocker | { ok: boolean }>, successText?: string) => {
    setBusy(key)
    setMsg(null)
    try {
      const res = await fn()
      if ('id' in res) onChanged(res)
      if (successText) setMsg({ tone: 'success', text: successText })
      admin.lockerEvents(locker.id).then(setEvents).catch(() => undefined)
    } catch (e) {
      setMsg({ tone: 'error', text: errorMessage(e, t('networkError')) })
    } finally {
      setBusy(null)
    }
  }

  const siteName = sites.find((s) => s.id === locker.siteId)?.name

  return (
    <Drawer open={!!locker} onClose={onClose} title={`${t('locker')} ${locker.label}`}>
      <div className="space-y-5">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge tone={lockerStateTone[locker.state]}>{t(`locker_${locker.state}`)}</Badge>
          <Badge tone={locker.online ? 'green' : 'red'}>{locker.online ? t('online') : t('offline')}</Badge>
          {siteName && <Badge tone="neutral">{siteName}</Badge>}
        </div>

        <dl className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-2 text-[15px] bg-paper p-4">
          <dt className="text-ink-3">{t('product')}</dt>
          <dd className="font-semibold">{locker.productName ?? '–'}</dd>
          <dt className="text-ink-3">{t('stockedAt')}</dt>
          <dd>{formatDateTime(locker.stockedAt, locale)}</dd>
          <dt className="text-ink-3">{t('currentOrder')}</dt>
          <dd className="font-semibold">{locker.currentOrderNumber ?? '–'}</dd>
          <dt className="text-ink-3">{t('deviceId')}</dt>
          <dd className="break-all">{locker.shellyDeviceId}</dd>
          <dt className="text-ink-3">{t('relayChannel')}</dt>
          <dd>{locker.relayChannel}</dd>
          <dt className="text-ink-3">{t('pulseSeconds')}</dt>
          <dd>{locker.pulseSeconds}</dd>
          {locker.note && (
            <>
              <dt className="text-ink-3">{t('note')}</dt>
              <dd>{locker.note}</dd>
            </>
          )}
        </dl>

        {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}

        <div className="space-y-2">
          <h3 className="text-xl font-extrabold tracking-[-0.03em] text-ink">{t('actions')}</h3>

          {(locker.state === 'EMPTY' || locker.state === 'SOLD') && (
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <Select label={t('stockWith')} value={stockProduct} onChange={(e) => setStockProduct(e.target.value)}>
                  {products.length === 0 && <option value="">{t('selectProduct')}</option>}
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{productName(p, locale)}</option>
                  ))}
                </Select>
              </div>
              <Button
                variant="success"
                loading={busy === 'stock'}
                disabled={!stockProduct}
                onClick={() =>
                  locker.state === 'SOLD'
                    ? setConfirm('soldStock')
                    : void run('stock', () => admin.stockLocker(locker.id, stockProduct))
                }
              >
                {locker.state === 'SOLD' ? t('soldRestock') : t('stock')}
              </Button>
            </div>
          )}

          {locker.state === 'STOCKED' && (
            <Button variant="secondary" full loading={busy === 'empty'} onClick={() => void run('empty', () => admin.emptyLocker(locker.id))}>
              {t('empty')}
            </Button>
          )}
          {locker.state === 'SOLD' && (
            <Button variant="secondary" full loading={busy === 'empty'} onClick={() => setConfirm('soldEmpty')}>
              {t('soldEmptied')}
            </Button>
          )}

          {(locker.state === 'EMPTY' || locker.state === 'STOCKED') && (
            <Button variant="danger" full loading={busy === 'ooo'} onClick={() => void run('ooo', () => admin.setOutOfOrder(locker.id, true))}>
              {t('markOutOfOrder')}
            </Button>
          )}
          {locker.state === 'OUT_OF_ORDER' && (
            <Button variant="success" full loading={busy === 'ooo'} onClick={() => void run('ooo', () => admin.setOutOfOrder(locker.id, false))}>
              {t('markWorking')}
            </Button>
          )}

          <Button variant="cta" full icon={<DoorOpen size={18} />} loading={busy === 'open'} onClick={() => setConfirm('open')}>
            {t('openDoor')}
          </Button>
          <Button variant="secondary" full onClick={onEdit}>{t('edit')}</Button>
        </div>

        <div>
          <h3 className="text-xl font-extrabold tracking-[-0.03em] text-ink mb-3">{t('events')}</h3>
          {events === null ? (
            <div className="text-[15px] text-ink-3">{t('loading')}</div>
          ) : events.length === 0 ? (
            <div className="text-[15px] text-ink-3">{t('noEvents')}</div>
          ) : (
            <ul className="grid gap-1 text-[15px]">
              {events.map((e) => (
                <li key={e.id} className={`px-3 py-2.5 ${e.type === 'OPEN_FAILED' ? 'bg-danger-50 text-danger-700' : 'bg-paper'}`}>
                  <div className="flex justify-between gap-2">
                    <span className="font-semibold">{t(`event_${e.type}`)}</span>
                    <span className="text-ink-3 whitespace-nowrap">{formatDateTime(e.createdAt, locale)}</span>
                  </div>
                  {e.detail && <div className="text-ink-3 break-words">{e.detail}</div>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirm === 'open'}
        title={t('openDoor')}
        message={t('openDoorConfirm', { label: locker.label })}
        confirmLabel={t('openDoor')}
        loading={busy === 'open'}
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          setConfirm(null)
          void run('open', () => admin.openLocker(locker.id), t('doorOpenSent'))
        }}
      />
      <ConfirmDialog
        open={confirm === 'soldEmpty'}
        title={t('soldEmptied')}
        message={t('soldEmptiedConfirm', { label: locker.label, number: locker.currentOrderNumber ?? '–' })}
        confirmLabel={t('soldEmptied')}
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          setConfirm(null)
          void run('empty', () => admin.emptyLocker(locker.id))
        }}
      />
      <ConfirmDialog
        open={confirm === 'soldStock'}
        title={t('soldRestock')}
        message={t('soldRestockConfirm', { label: locker.label, number: locker.currentOrderNumber ?? '–' })}
        confirmLabel={t('soldRestock')}
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          setConfirm(null)
          void run('stock', () => admin.stockLocker(locker.id, stockProduct))
        }}
      />
    </Drawer>
  )
}

function LockerForm({
  open,
  siteId,
  sites,
  locker,
  onClose,
  onSaved,
}: {
  open: boolean
  siteId: string
  sites: AdminSite[]
  locker: AdminLocker | null
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const { t } = useT()
  const [form, setForm] = useState<LockerInput>(emptyInput(siteId))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    setForm(
      locker
        ? { siteId: locker.siteId, label: locker.label, shellyDeviceId: locker.shellyDeviceId, relayChannel: locker.relayChannel, pulseSeconds: locker.pulseSeconds, note: locker.note }
        : emptyInput(siteId),
    )
  }, [open, locker, siteId])

  const set = <K extends keyof LockerInput>(k: K, v: LockerInput[K]) => setForm((f) => ({ ...f, [k]: v }))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const body = { ...form, note: form.note?.trim() || null }
      if (locker) await admin.updateLocker(locker.id, body)
      else await admin.createLocker(body)
      await onSaved()
    } catch (err) {
      setError(errorMessage(err, t('networkError')))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={locker ? t('editLocker') : t('addLocker')}>
      <form onSubmit={submit} className="space-y-4" id="locker-form">
        {sites.length > 1 && (
          <Select label={t('site')} value={form.siteId} onChange={(e) => set('siteId', e.target.value)}>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </Select>
        )}
        <Input label={t('label')} name="label" required value={form.label} onChange={(e) => set('label', e.target.value)} placeholder="A1" />
        <Input label={t('deviceId')} name="shellyDeviceId" required value={form.shellyDeviceId} onChange={(e) => set('shellyDeviceId', e.target.value)} placeholder="shellyplus1-a8032abcdef0" />
        <div className="grid grid-cols-2 gap-3">
          <Input label={t('relayChannel')} name="relayChannel" type="number" min={0} max={7} required value={form.relayChannel} onChange={(e) => set('relayChannel', Number(e.target.value))} />
          <Input label={t('pulseSeconds')} name="pulseSeconds" type="number" min={1} max={60} required value={form.pulseSeconds} onChange={(e) => set('pulseSeconds', Number(e.target.value))} />
        </div>
        <Textarea label={t('note')} name="note" value={form.note ?? ''} onChange={(e) => set('note', e.target.value)} />
        {error && <Alert tone="error">{error}</Alert>}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>{t('cancel')}</Button>
          <Button type="submit" variant="cta" loading={saving}>{t('save')}</Button>
        </div>
      </form>
    </Modal>
  )
}
