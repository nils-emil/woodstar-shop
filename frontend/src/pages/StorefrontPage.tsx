import { useMemo, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Check } from 'lucide-react'
import { api, isApiError } from '@/api/client'
import type { PublicProduct, PublicSite } from '@/api/types'
import { Alert } from '@/components/Alert'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { PageSpinner } from '@/components/Spinner'
import { errorMessage, useAsync } from '@/components/useAsync'
import { formatPrice, productDescription, productName, useT, type TFunction } from '@/i18n'
import { photos } from '@/photos'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function stockText(n: number, t: TFunction) {
  if (n <= 0) return t('soldOut')
  if (n === 1) return t('lastOne')
  return t('available', { n })
}

export function StorefrontPage() {
  const { t, locale } = useT()
  const [params, setParams] = useSearchParams()
  const sites = useAsync(() => api.sites())
  const status = useAsync(() => api.status())
  // Until a payment provider is configured the shop shows stock but does not take orders.
  const salesOpen = status.data?.salesOpen ?? true
  const [siteId, setSiteId] = useState<string | null>(null)
  const [productId, setProductId] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [emailError, setEmailError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [notice, setNotice] = useState<{ tone: 'warning' | 'error'; text: string } | null>(
    params.get('cancelled') ? { tone: 'warning', text: t('paymentCancelled') } : null,
  )

  const site: PublicSite | undefined = useMemo(
    () => sites.data?.find((s) => s.id === siteId) ?? sites.data?.[0],
    [sites.data, siteId],
  )
  const product: PublicProduct | undefined =
    site?.products.find((p) => p.id === productId) ?? site?.products.find((p) => p.available > 0)
  const lowestPrice = site?.products.length ? Math.min(...site.products.map((p) => p.priceCents)) : null

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!site || !product) return
    if (!EMAIL_RE.test(email.trim())) {
      setEmailError(t('invalidEmail'))
      return
    }
    setEmailError(null)
    setSubmitting(true)
    setNotice(null)
    try {
      const res = await api.createOrder({
        siteId: site.id,
        productId: product.id,
        email: email.trim(),
        phone: phone.trim() || undefined,
        locale,
      })
      window.location.assign(res.checkoutUrl)
    } catch (err) {
      setSubmitting(false)
      if (isApiError(err) && err.code === 'SALES_CLOSED') {
        setNotice({ tone: 'warning', text: t('salesClosed') })
        await status.reload()
      } else if (isApiError(err) && err.code === 'SOLD_OUT') {
        setNotice({ tone: 'warning', text: t('soldOutJustNow') })
        setProductId(null)
        await sites.reload()
      } else {
        setNotice({ tone: 'error', text: errorMessage(err, t('networkError')) })
      }
    }
  }

  if (sites.loading && !sites.data) return <PageSpinner />
  if (sites.error && !sites.data)
    return (
      <div className="space-y-4 py-16">
        <Alert tone="error">{t('networkError')}</Alert>
        <Button variant="secondary" onClick={() => void sites.reload()}>{t('retry')}</Button>
      </div>
    )

  return (
    <div className="grid gap-x-16 gap-y-10 pt-6 pb-8 lg:grid-cols-[1fr_minmax(0,520px)] lg:pt-12">
      {/* What it is, where, and what it costs */}
      <div className="grid content-start gap-6 enter">
        <h1 className="head max-w-[14ch]">{t('heroTitle')}</h1>
        <ul className="grid gap-1 lead font-semibold list-none p-0 m-0">
          {site && <li>{site.address}</li>}
          {lowestPrice !== null && <li>{t('heroFrom', { price: formatPrice(lowestPrice) })}</li>}
          <li>{t('heroOpen')}</li>
        </ul>
        <figure className="m-0 hidden lg:block">
          <img
            src={photos.birch.src}
            width={photos.birch.width}
            height={photos.birch.height}
            alt={t(photos.birch.caption)}
            className="block w-full aspect-[4/3] object-cover"
          />
          <figcaption className="small mt-2 text-ink-3">
            {t(photos.birch.caption)}. {t('photo')}: {photos.birch.creator}, {photos.birch.license}
          </figcaption>
        </figure>
      </div>

      {/* The purchase */}
      <form
        onSubmit={onSubmit}
        noValidate
        className="bg-paper p-5 sm:p-7 grid gap-6 content-start enter"
        style={{ ['--i' as string]: 1 }}
      >
        {notice && (
          <Alert tone={notice.tone}>
            {notice.text}{' '}
            {params.get('cancelled') && (
              <button
                type="button"
                className="font-semibold underline"
                onClick={() => {
                  setParams({})
                  setNotice(null)
                }}
              >
                {t('close')}
              </button>
            )}
          </Alert>
        )}

        {!sites.data?.length ? (
          <Alert tone="info">{t('noSites')}</Alert>
        ) : (
          <>
            {sites.data.length > 1 && (
              <fieldset className="grid gap-2 border-0 p-0 m-0">
                <legend className="mb-2 font-semibold">{t('chooseSite')}</legend>
                {sites.data.map((s) => (
                  <Choice
                    key={s.id}
                    name="site"
                    checked={s.id === site?.id}
                    onChange={() => {
                      setSiteId(s.id)
                      setProductId(null)
                    }}
                    title={s.name}
                    detail={s.address}
                  />
                ))}
              </fieldset>
            )}

            <fieldset className="grid gap-2 border-0 p-0 m-0">
              <legend className="mb-2 font-semibold">{t('chooseBag')}</legend>
              {site && site.products.length === 0 && <Alert tone="info">{t('nothingHere')}</Alert>}
              {site?.products.map((p) => (
                <Choice
                  key={p.id}
                  name="product"
                  checked={p.id === product?.id}
                  disabled={p.available <= 0}
                  onChange={() => setProductId(p.id)}
                  title={productName(p, locale)}
                  detail={productDescription(p, locale)}
                  price={formatPrice(p.priceCents)}
                  stock={stockText(p.available, t)}
                />
              ))}
            </fieldset>

            {!salesOpen ? (
              <Alert tone="info">{t('salesClosed')}</Alert>
            ) : (
              <>
                <div className="grid gap-4">
                  <Input
                    label={t('email')}
                    name="email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    hint={t('emailHint')}
                    error={emailError ?? undefined}
                  />
                  <Input
                    label={t('phone')}
                    name="phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>

                <div className="grid gap-2">
                  <Button type="submit" variant="cta" size="lg" full loading={submitting} disabled={!product}>
                    {submitting
                      ? t('redirectingToPayment')
                      : product
                        ? t('buyFor', { price: formatPrice(product.priceCents) })
                        : t('soldOut')}
                  </Button>
                  <p className="small text-ink-3 text-center">
                    {t('vatIncluded')} · {t('paymentBy')}
                  </p>
                  {status.data?.demo && <p className="small font-semibold text-center">{t('demoNotice')}</p>}
                </div>
              </>
            )}
          </>
        )}
      </form>

      {/* How it works, in three plain lines */}
      <section className="lg:col-span-2 grid gap-5 pt-6" aria-labelledby="how-title">
        <h2 id="how-title" className="text-[1.75rem] font-extrabold tracking-[-0.04em]">{t('howItWorks')}</h2>
        <ol className="grid gap-3 sm:grid-cols-3 list-none p-0 m-0">
          {[t('step1'), t('step2'), t('step3')].map((step) => (
            <li key={step} className="bg-surface p-5 lead font-semibold">{step}</li>
          ))}
        </ol>
      </section>
    </div>
  )
}

function Choice({
  name,
  checked,
  disabled,
  onChange,
  title,
  detail,
  price,
  stock,
}: {
  name: string
  checked: boolean
  disabled?: boolean
  onChange: () => void
  title: string
  detail?: string | null
  price?: string
  stock?: string
}) {
  return (
    <label
      className={`flex items-start gap-4 p-4 transition-colors has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-accent-600 ${
        disabled
          ? 'bg-canvas text-ink-3 cursor-not-allowed'
          : checked
            ? 'bg-ink text-paper cursor-pointer'
            : 'bg-canvas hover:bg-surface cursor-pointer'
      }`}
    >
      <input type="radio" name={name} checked={checked} disabled={disabled} onChange={onChange} className="sr-only" />
      <span
        className={`mt-0.5 grid place-items-center h-6 w-6 shrink-0 ${checked ? 'bg-accent-600 text-white' : 'bg-paper'}`}
        aria-hidden="true"
      >
        {checked && <Check size={16} strokeWidth={3} />}
      </span>
      <span className="flex-1 min-w-0">
        <span className="flex items-baseline justify-between gap-3">
          <span className="font-semibold">{title}</span>
          {price && <span className="font-semibold whitespace-nowrap">{price}</span>}
        </span>
        {detail && <span className="block mt-0.5">{detail}</span>}
        {stock && <span className="block mt-1 small font-semibold">{stock}</span>}
      </span>
    </label>
  )
}
