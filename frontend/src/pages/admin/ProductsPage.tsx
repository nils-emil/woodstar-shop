import { useEffect, useState, type FormEvent } from 'react'
import { Pencil, Plus } from 'lucide-react'
import { admin } from '@/api/client'
import type { AdminProduct, ProductInput } from '@/api/types'
import { Alert } from '@/components/Alert'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { Checkbox, Input, Textarea } from '@/components/Input'
import { Modal } from '@/components/Modal'
import { PageSpinner } from '@/components/Spinner'
import { errorMessage, useAsync } from '@/components/useAsync'
import { formatPrice, productName, useT } from '@/i18n'
import { PageHeader } from './AdminLayout'

const empty: ProductInput = { nameEt: '', nameEn: '', descriptionEt: null, descriptionEn: null, priceCents: 0, active: true, sortOrder: 0 }

export function ProductsPage() {
  const { t, locale } = useT()
  const products = useAsync(() => admin.products())
  const [editing, setEditing] = useState<AdminProduct | null | 'new'>(null)

  return (
    <div>
      <PageHeader title={t('products')}>
        <Button icon={<Plus size={18} />} onClick={() => setEditing('new')}>{t('addProduct')}</Button>
      </PageHeader>
      {products.error && <Alert tone="error" className="mb-4">{products.error}</Alert>}
      {products.loading && !products.data ? (
        <PageSpinner />
      ) : !products.data?.length ? (
        <Alert tone="info">{t('noProducts')}</Alert>
      ) : (
        <Card className="divide-y divide-wood-100">
          {[...products.data].sort((a, b) => a.sortOrder - b.sortOrder).map((p) => (
            <div key={p.id} className="flex items-center gap-3 px-4 py-3">
              <div className="flex-1 min-w-0">
                <div className="font-bold flex items-center gap-2">
                  {productName(p, locale)}
                  {!p.active && <Badge tone="neutral">{t('inactive')}</Badge>}
                </div>
                <div className="text-sm text-stone-500 truncate">{locale === 'et' ? p.nameEn : p.nameEt}</div>
              </div>
              <div className="font-extrabold text-wood-800 whitespace-nowrap">{formatPrice(p.priceCents)}</div>
              <Button variant="ghost" size="sm" icon={<Pencil size={16} />} onClick={() => setEditing(p)}>{t('edit')}</Button>
            </div>
          ))}
        </Card>
      )}
      <ProductForm
        product={editing === 'new' ? null : editing}
        open={editing !== null}
        onClose={() => setEditing(null)}
        onSaved={async () => { setEditing(null); await products.reload() }}
      />
    </div>
  )
}

function ProductForm({ product, open, onClose, onSaved }: { product: AdminProduct | null; open: boolean; onClose: () => void; onSaved: () => Promise<void> }) {
  const { t } = useT()
  const [form, setForm] = useState<ProductInput>(empty)
  const [priceEur, setPriceEur] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    const f = product ? { nameEt: product.nameEt, nameEn: product.nameEn, descriptionEt: product.descriptionEt, descriptionEn: product.descriptionEn, priceCents: product.priceCents, active: product.active, sortOrder: product.sortOrder } : empty
    setForm(f)
    setPriceEur(product ? (product.priceCents / 100).toFixed(2) : '')
  }, [open, product])

  const set = <K extends keyof ProductInput>(k: K, v: ProductInput[K]) => setForm((f) => ({ ...f, [k]: v }))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const cents = Math.round(Number(priceEur.replace(',', '.')) * 100)
      const body: ProductInput = { ...form, priceCents: Number.isFinite(cents) ? cents : 0, descriptionEt: form.descriptionEt?.trim() || null, descriptionEn: form.descriptionEn?.trim() || null }
      if (product) await admin.updateProduct(product.id, body)
      else await admin.createProduct(body)
      await onSaved()
    } catch (err) {
      setError(errorMessage(err, t('networkError')))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={product ? t('editProduct') : t('addProduct')}>
      <form onSubmit={submit} className="space-y-4">
        <Input label={t('nameEt')} name="nameEt" required value={form.nameEt} onChange={(e) => set('nameEt', e.target.value)} />
        <Input label={t('nameEn')} name="nameEn" required value={form.nameEn} onChange={(e) => set('nameEn', e.target.value)} />
        <Textarea label={t('descriptionEt')} name="descriptionEt" value={form.descriptionEt ?? ''} onChange={(e) => set('descriptionEt', e.target.value)} />
        <Textarea label={t('descriptionEn')} name="descriptionEn" value={form.descriptionEn ?? ''} onChange={(e) => set('descriptionEn', e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <Input label={t('priceEur')} name="price" inputMode="decimal" required value={priceEur} onChange={(e) => setPriceEur(e.target.value)} placeholder="12.00" />
          <Input label={t('sortOrder')} name="sortOrder" type="number" value={form.sortOrder} onChange={(e) => set('sortOrder', Number(e.target.value))} />
        </div>
        <Checkbox label={t('active')} checked={form.active} onChange={(e) => set('active', e.target.checked)} />
        {error && <Alert tone="error">{error}</Alert>}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>{t('cancel')}</Button>
          <Button type="submit" loading={saving}>{t('save')}</Button>
        </div>
      </form>
    </Modal>
  )
}
