import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { isApiError } from '@/api/client'
import { Alert } from '@/components/Alert'
import { Backdrop } from '@/components/Backdrop'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { LanguageToggle } from '@/components/LanguageToggle'
import { Logo } from '@/components/Logo'
import { errorMessage } from '@/components/useAsync'
import { useT } from '@/i18n'
import { useAuth } from './auth'

export function LoginPage() {
  const { t } = useT()
  const { username: current, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  if (current) return <Navigate to="/admin" replace />

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await login(username, password)
      const from = (location.state as { from?: string } | null)?.from
      navigate(from && from.startsWith('/admin') ? from : '/admin', { replace: true })
    } catch (err) {
      setError(isApiError(err) && err.status === 401 ? t('loginFailed') : errorMessage(err, t('networkError')))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-dvh flex flex-col items-center justify-center p-4 gap-6">
      <Backdrop />
      <div className="relative z-10 flex items-center gap-2.5 fade-up">
        <Logo size={36} />
        <span className="text-xl font-bold text-ink tracking-tight">{t('appName')}</span>
        <span className="text-xs font-semibold text-ink-4 uppercase tracking-wide mt-0.5">{t('admin')}</span>
      </div>
      <div className="relative z-10 card rounded-2xl p-6 w-full max-w-sm fade-up" style={{ ['--i' as string]: 1 }}>
        <form onSubmit={onSubmit} className="space-y-4">
          <Input label={t('username')} name="username" autoComplete="username" required value={username} onChange={(e) => setUsername(e.target.value)} />
          <Input label={t('password')} name="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          {error && <Alert tone="error">{error}</Alert>}
          <Button type="submit" variant="cta" size="lg" full loading={loading}>{t('login')}</Button>
        </form>
      </div>
      <div className="relative z-10 fade-up" style={{ ['--i' as string]: 2 }}><LanguageToggle /></div>
    </div>
  )
}
