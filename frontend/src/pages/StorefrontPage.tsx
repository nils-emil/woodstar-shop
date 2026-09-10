import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Check, ChevronRight, Clock, MapPin, ShieldCheck, Smartphone, KeyRound } from 'lucide-react'
import { api, isApiError } from '@/api/client'
import type { PublicProduct, PublicSite } from '@/api/types'
import { Alert } from '@/components/Alert'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { LogsIcon } from '@/components/LogsIcon'
import { PageSpinner } from '@/components/Spinner'
import { errorMessage, useAsync } from '@/components/useAsync'
import { formatPrice, productDescription, productName, useT } from '@/i18n'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function StepLabel({ n, done, children }: { n: number; done?: boolean; children: string }) {
  return (
    <h2 className="mb-3 flex items-center gap-2.5 text-sm font-semibold text-ink-2">
      <span
        className={`grid place-items-center h-6 w-6 rounded-full text-[11px] font-bold ${
          done ? 'bg-success-500 text-white' : 'bg-ink text-white'
        }`}
      >
        {done ? <Check size={13} strokeWidth={3} /> : n}
      </span>
      {children}
    </h2>
  )
}

export function StorefrontPage() {
  const { t, locale } = useT()
  const [params, setParams] = useSearchParams()
  const sites = useAsync(() => api.sites())
  const [siteId, setSiteId] = useState<string | null>(null)
  const [productId, setProductId] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [emailError, setEmailError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [notice, setNotice] = useState<{ tone: 'warning' | 'error'; text: string } | null>(
    params.get('cancelled') ? { tone: 'warning', text: t('paymentCancelled') } : null,
  )

  useEffect(() => {
    if (sites.data && sites.data.length === 1 && !siteId) setSiteId(sites.data[0]!.id)
  }, [sites.data, siteId])

  const site: PublicSite | undefined = useMemo(
    () => sites.data?.find((s) => s.id === siteId),
    [sites.data, siteId],
  )
  const product: PublicProduct | undefined = site?.products.find((p) => p.id === productId)

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
      if (isApiError(err) && err.code === 'SOLD_OUT') {
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
      <div className="space-y-3 pt-6">
        <Alert tone="error">{t('networkError')}</Alert>
        <Button variant="secondary" onClick={() => void sites.reload()}>{t('retry')}</Button>
      </div>
    )

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="pt-8 pb-1 fade-up" style={{ ['--i' as string]: 0 }}>
        <h1 className="font-display text-[2.35rem] leading-[1.08] font-medium text-ink sm:text-[2.75rem]">{t('tagline')}</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-3 max-w-md">{t('heroLead')}</p>
        <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-ink-3">
          <span className="inline-flex items-center gap-1.5"><Clock size={15} className="text-accent-600" /> 24/7</span>
          <span className="inline-flex items-center gap-1.5"><ShieldCheck size={15} className="text-accent-600" /> {t('securePayment')}</span>
          <span className="inline-flex items-center gap-1.5"><KeyRound size={15} className="text-accent-600" /> {t('openWithPhone')}</span>
        </div>
      </div>

      {notice && (
        <Alert tone={notice.tone} className="fade-up">
          {notice.text}
          {params.get('cancelled') && (
            <button className="ml-2 font-semibold underline" onClick={() => { setParams({}); setNotice(null) }}>
              {t('close')}
            </button>
          )}
        </Alert>
      )}

      {/* Step 1: site */}
      <section className="fade-up" style={{ ['--i' as string]: 1 }}>
        <StepLabel n={1} done={!!site}>{t('chooseSite')}</StepLabel>
        {!sites.data?.length ? (
          <Alert tone="info">{t('noSites')}</Alert>
        ) : site ? (
          <div className="card rounded-2xl p-4 flex items-center gap-3">
            <span className="grid place-items-center h-10 w-10 rounded-xl bg-accent-50 text-accent-600 shrink-0">
              <MapPin size={19} />
            </span>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-ink">{site.name}</div>
              <div className="text-sm text-ink-3 truncate">{site.address}</div>
            </div>
            {sites.data.length > 1 && (
              <button className="text-sm font-semibold text-accent-600 hover:text-accent-700" onClick={() => { setSiteId(null); setProductId(null) }}>
                {t('changeSite')}
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-2.5">
            {sites.data.map((s, i) => (
              <button
                key={s.id}
                onClick={() => setSiteId(s.id)}
                style={{ ['--i' as string]: i + 1 }}
                className="fade-up card card-interactive text-left rounded-2xl p-4 flex items-center gap-3"
              >
                <span className="grid place-items-center h-10 w-10 rounded-xl bg-accent-50 text-accent-600 shrink-0">
                  <MapPin size={19} />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-ink">{s.name}</div>
                  <div className="text-sm text-ink-3 truncate">{s.address}</div>
                </div>
                <ChevronRight className="text-ink-4" size={20} />
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Step 2: product */}
      {site && (
        <section className="fade-up" style={{ ['--i' as string]: 2 }}>
          <StepLabel n={2} done={!!product}>{t('chooseProduct')}</StepLabel>
          {site.products.length === 0 ? (
            <Alert tone="info">{t('nothingHere')}</Alert>
          ) : (
            <div className="grid gap-3">
              {site.products.map((p, i) => {
                const out = p.available <= 0
                const selected = p.id === productId
                const desc = productDescription(p, locale)
                return (
                  <button
                    key={p.id}
                    disabled={out}
                    onClick={() => setProductId(p.id)}
                    aria-pressed={selected}
                    style={{ ['--i' as string]: i + 2 }}
                    className={`fade-up card relative text-left rounded-2xl p-4 flex gap-4 ${
                      out ? 'opacity-55 cursor-not-allowed' : selected ? 'card-selected' : 'card-interactive'
                    }`}
                  >
                    <span
                      className={`grid place-items-center h-14 w-14 rounded-xl shrink-0 ${
                        selected ? 'bg-accent-600 text-white' : 'bg-accent-50 text-accent-600'
                      }`}
                    >
                      <LogsIcon size={28} />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="flex items-start justify-between gap-3">
                        <span className="font-semibold text-[15px] leading-snug text-ink">{productName(p, locale)}</span>
                        <span className="font-semibold text-[15px] whitespace-nowrap text-ink tabular-nums">{formatPrice(p.priceCents)}</span>
                      </span>
                      {desc && <span className="block text-sm text-ink-3 mt-0.5">{desc}</span>}
                      <span className="mt-2.5 block text-xs font-medium">
                        {out ? (
                          <span className="text-ink-4">{t('soldOut')}</span>
                        ) : p.available === 1 ? (
                          <span className="text-warn-700">{t('lastOne')}</span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-success-700">
                            <span className="h-1.5 w-1.5 rounded-full bg-success-500" />
                            {t('available', { n: p.available })}
                          </span>
                        )}
                      </span>
                    </span>
                    {selected && (
                      <span className="absolute -top-2 -right-2 grid place-items-center h-6 w-6 rounded-full bg-accent-600 text-white ring-2 ring-white animate-pop-in">
                        <Check size={14} strokeWidth={3} />
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </section>
      )}

      {/* Step 3: details */}
      {site && product && (
        <section className="fade-up" style={{ ['--i' as string]: 0 }}>
          <StepLabel n={3}>{t('yourDetails')}</StepLabel>
          <div className="card rounded-2xl p-5">
            <form onSubmit={onSubmit} className="space-y-4" noValidate>
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
              <div className="pt-1 border-t border-line flex items-center justify-between text-sm">
                <span className="text-ink-3 pt-3">{productName(product, locale)}</span>
                <span className="font-semibold text-ink pt-3 tabular-nums">{formatPrice(product.priceCents)}</span>
              </div>
              <Button type="submit" variant="cta" size="lg" full loading={submitting}>
                {submitting ? t('redirectingToPayment') : t('buyFor', { price: formatPrice(product.priceCents) })}
              </Button>
              <p className="flex items-center justify-center gap-1.5 text-center text-xs text-ink-4">
                <ShieldCheck size={13} /> {t('vatIncluded')} · {t('paymentBy')}
              </p>
            </form>
          </div>
        </section>
      )}

      {/* How it works */}
      <section className="pt-4 fade-up" style={{ ['--i' as string]: 3 }}>
        <h2 className="mb-3 text-sm font-semibold text-ink-2">{t('howItWorks')}</h2>
        <ol className="card rounded-2xl divide-y divide-line">
          {[
            { icon: <LogsIcon size={18} />, text: t('step1') },
            { icon: <Smartphone size={18} />, text: t('step2') },
            { icon: <KeyRound size={18} />, text: t('step3') },
          ].map((s, i) => (
            <li key={i} className="flex items-center gap-3.5 px-4 py-3.5">
              <span className="grid place-items-center h-9 w-9 rounded-lg bg-accent-50 text-accent-600 shrink-0">{s.icon}</span>
              <span className="text-sm text-ink-2">
                <span className="font-semibold text-ink mr-1.5">{i + 1}.</span>
                {s.text}
              </span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}
