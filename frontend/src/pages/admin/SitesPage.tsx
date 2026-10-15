import { useEffect, useState, type FormEvent } from 'react'
import { MapPin, Pencil, Plus } from 'lucide-react'
import { admin } from '@/api/client'
import type { AdminSite, SiteInput } from '@/api/types'
import { Alert } from '@/components/Alert'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { Checkbox, Input } from '@/components/Input'
import { Modal } from '@/components/Modal'
import { PageSpinner } from '@/components/Spinner'
import { errorMessage, useAsync } from '@/components/useAsync'
import { useT } from '@/i18n'
import { PageHeader } from './AdminLayout'

const empty: SiteInput = { name: '', address: '', lat: null, lng: null, active: true }

export function SitesPage() {
  const { t } = useT()
  const sites = useAsync(() => admin.sites())
  const [editing, setEditing] = useState<AdminSite | null | 'new'>(null)

  return (
    <div>
      <PageHeader title={t('sites')}>
        <Button variant="cta" icon={<Plus size={18} />} onClick={() => setEditing('new')}>{t('addSite')}</Button>
      </PageHeader>
      {sites.error && <Alert tone="error" className="mb-4">{sites.error}</Alert>}
      {sites.loading && !sites.data ? (
        <PageSpinner />
      ) : !sites.data?.length ? (
        <Alert tone="info">{t('nothingHere')}</Alert>
      ) : (
        <div className="grid gap-1">
          {sites.data.map((s) => (
            <Card key={s.id} className="flex items-center gap-4 px-5 py-4">
              <MapPin className="text-ink-3 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-bold text-[17px] flex items-center gap-2">
                  {s.name}
                  {!s.active && <Badge tone="neutral">{t('inactive')}</Badge>}
                </div>
                <div className="text-[15px] text-ink-3 truncate">{s.address}</div>
              </div>
              <Button variant="secondary" size="sm" icon={<Pencil size={16} />} onClick={() => setEditing(s)}>{t('edit')}</Button>
            </Card>
          ))}
        </div>
      )}
      <SiteForm
        site={editing === 'new' ? null : editing}
        open={editing !== null}
        onClose={() => setEditing(null)}
        onSaved={async () => { setEditing(null); await sites.reload() }}
      />
    </div>
  )
}

function SiteForm({ site, open, onClose, onSaved }: { site: AdminSite | null; open: boolean; onClose: () => void; onSaved: () => Promise<void> }) {
  const { t } = useT()
  const [form, setForm] = useState<SiteInput>(empty)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    setForm(site ? { name: site.name, address: site.address, lat: site.lat, lng: site.lng, active: site.active } : empty)
  }, [open, site])

  const set = <K extends keyof SiteInput>(k: K, v: SiteInput[K]) => setForm((f) => ({ ...f, [k]: v }))
  const num = (v: string): number | null => (v.trim() === '' ? null : Number(v.replace(',', '.')))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      if (site) await admin.updateSite(site.id, form)
      else await admin.createSite(form)
      await onSaved()
    } catch (err) {
      setError(errorMessage(err, t('networkError')))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={site ? t('editSite') : t('addSite')}>
      <form onSubmit={submit} className="space-y-4">
        <Input label={t('name')} name="name" required value={form.name} onChange={(e) => set('name', e.target.value)} />
        <Input label={t('address')} name="address" required value={form.address} onChange={(e) => set('address', e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <Input label={t('lat')} name="lat" inputMode="decimal" value={form.lat ?? ''} onChange={(e) => set('lat', num(e.target.value))} placeholder="59.4339" />
          <Input label={t('lng')} name="lng" inputMode="decimal" value={form.lng ?? ''} onChange={(e) => set('lng', num(e.target.value))} placeholder="24.8067" />
        </div>
        <Checkbox label={t('active')} checked={form.active} onChange={(e) => set('active', e.target.checked)} />
        {error && <Alert tone="error">{error}</Alert>}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>{t('cancel')}</Button>
          <Button type="submit" variant="cta" loading={saving}>{t('save')}</Button>
        </div>
      </form>
    </Modal>
  )
}
