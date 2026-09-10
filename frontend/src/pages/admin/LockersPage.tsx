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
  EMPTY: 'bg-stone-100 border-stone-300 text-stone-700',
  STOCKED: 'bg-green-100 border-green-400 text-green-900',
  RESERVED: 'bg-amber-100 border-amber-400 text-amber-900',
  SOLD: 'bg-sky-100 border-sky-400 text-sky-900',
  OUT_OF_ORDER: 'bg-red-100 border-red-400 text-red-900',
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
        <Button icon={<Plus size={18} />} onClick={() => { setEditing(null); setFormOpen(true) }} disabled={!siteId}>
          {t('addLocker')}
        </Button>
      </PageHeader>

      {sites.data && sites.data.length > 1 && (
        <div className="max-w-xs mb-5">
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
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {sorted.map((l) => (
            <button
              key={l.id}
              onClick={() => setSelectedId(l.id)}
              className={`text-left rounded-2xl border-2 p-3 min-h-28 flex flex-col transition-shadow hover:shadow-md ${tileColors[l.state]}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-2xl font-black">{l.label}</span>
                <span title={l.online ? t('online') : t('offline')} className={l.online ? 'text-green-600' : 'text-red-500'}>
                  {l.online ? <Wifi size={16} /> : <WifiOff size={16} />}
                </span>
              </div>
              <div className="text-xs font-semibold uppercase mt-1">{t(`locker_${l.state}`)}</div>
              <div className="text-sm mt-auto pt-2 truncate">{l.productName ?? <span className="opacity-60">{t('noProduct')}</span>}</div>
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
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [events, setEvents] = useState<LockerEvent[] | null>(null)

  useEffect(() => {
    setMsg(null)
    setEvents(null)
    setStockProduct(products.find((p) => p.active)?.id ?? products[0]?.id ?? '')
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
          {siteName && <Badge tone="wood">{siteName}</Badge>}
        </div>

        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
          <dt className="text-stone-500">{t('product')}</dt>
          <dd className="font-semibold">{locker.productName ?? '–'}</dd>
          <dt className="text-stone-500">{t('stockedAt')}</dt>
          <dd>{formatDateTime(locker.stockedAt, locale)}</dd>
          <dt className="text-stone-500">{t('currentOrder')}</dt>
          <dd className="font-mono">{locker.currentOrderNumber ?? '–'}</dd>
          <dt className="text-stone-500">{t('deviceId')}</dt>
          <dd className="font-mono break-all">{locker.shellyDeviceId}</dd>
          <dt className="text-stone-500">{t('relayChannel')}</dt>
          <dd>{locker.relayChannel}</dd>
          <dt className="text-stone-500">{t('pulseSeconds')}</dt>
          <dd>{locker.pulseSeconds}</dd>
          {locker.note && (
            <>
              <dt className="text-stone-500">{t('note')}</dt>
              <dd>{locker.note}</dd>
            </>
          )}
        </dl>

        {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}

        <div className="space-y-2">
          <h3 className="text-sm font-bold uppercase tracking-wide text-wood-600">{t('actions')}</h3>

          {locker.state === 'EMPTY' && (
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <Select label={t('stockWith')} value={stockProduct} onChange={(e) => setStockProduct(e.target.value)}>
                  {products.length === 0 && <option value="">{t('selectProduct')}</option>}
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{productName(p, locale)}</option>
                  ))}
                </Select>
              </div>
              <Button variant="success" loading={busy === 'stock'} disabled={!stockProduct} onClick={() => void run('stock', () => admin.stockLocker(locker.id, stockProduct))}>
                {t('stock')}
              </Button>
            </div>
          )}

          {locker.state === 'STOCKED' && (
            <Button variant="secondary" full loading={busy === 'empty'} onClick={() => void run('empty', () => admin.emptyLocker(locker.id))}>
              {t('empty')}
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

          <Button full icon={<DoorOpen size={18} />} loading={busy === 'open'} onClick={() => setConfirmOpen(true)}>
            {t('openDoor')}
          </Button>
          <Button variant="ghost" full onClick={onEdit}>{t('edit')}</Button>
        </div>

        <div>
          <h3 className="text-sm font-bold uppercase tracking-wide text-wood-600 mb-2">{t('events')}</h3>
          {events === null ? (
            <div className="text-sm text-stone-400">{t('loading')}</div>
          ) : events.length === 0 ? (
            <div className="text-sm text-stone-400">{t('noEvents')}</div>
          ) : (
            <ul className="divide-y divide-wood-100 text-sm">
              {events.map((e) => (
                <li key={e.id} className="py-2">
                  <div className="flex justify-between gap-2">
                    <span className={`font-semibold ${e.type === 'OPEN_FAILED' ? 'text-red-700' : ''}`}>{t(`event_${e.type}`)}</span>
                    <span className="text-stone-400 whitespace-nowrap">{formatDateTime(e.createdAt, locale)}</span>
                  </div>
                  {e.detail && <div className="text-stone-500 break-words">{e.detail}</div>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title={t('openDoor')}
        message={t('openDoorConfirm', { label: locker.label })}
        confirmLabel={t('openDoor')}
        loading={busy === 'open'}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false)
          void run('open', () => admin.openLocker(locker.id), t('doorOpenSent'))
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
          <Button type="button" variant="ghost" onClick={onClose}>{t('cancel')}</Button>
          <Button type="submit" loading={saving}>{t('save')}</Button>
        </div>
      </form>
    </Modal>
  )
}
