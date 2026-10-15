import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { isApiError } from '@/api/client'
import { Alert } from '@/components/Alert'
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
    <div className="min-h-dvh bg-canvas flex flex-col items-center justify-center p-4 gap-8">
      <div className="flex items-center gap-3 enter">
        <Logo size={40} className="text-ink" />
        <span className="text-4xl font-extrabold text-ink tracking-[-0.05em]">{t('appName')}</span>
        <span className="text-[16px] font-semibold text-ink-3">{t('admin')}</span>
      </div>
      <div className="bg-paper p-6 sm:p-8 w-full max-w-sm enter" style={{ ['--i' as string]: 1 }}>
        <form onSubmit={onSubmit} className="space-y-4">
          <Input label={t('username')} name="username" autoComplete="username" required value={username} onChange={(e) => setUsername(e.target.value)} />
          <Input label={t('password')} name="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          {error && <Alert tone="error">{error}</Alert>}
          <Button type="submit" variant="cta" size="lg" full loading={loading}>{t('login')}</Button>
        </form>
      </div>
      <div className="enter" style={{ ['--i' as string]: 2 }}><LanguageToggle /></div>
    </div>
  )
}
