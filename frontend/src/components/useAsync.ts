import { useCallback, useEffect, useRef, useState } from 'react'
import { isApiError } from '@/api/client'

export interface AsyncState<T> {
  data: T | null
  loading: boolean
  error: string | null
  errorCode: string | null
  reload: () => Promise<void>
  setData: (d: T | null) => void
}

/** Loads data once (and whenever deps change); exposes reload. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []): AsyncState<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [errorCode, setErrorCode] = useState<string | null>(null)
  const fnRef = useRef(fn)
  fnRef.current = fn

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const d = await fnRef.current()
      setData(d)
      setError(null)
      setErrorCode(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setErrorCode(isApiError(e) ? e.code : 'UNKNOWN')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return { data, loading, error, errorCode, reload, setData }
}

export function errorMessage(e: unknown, fallback: string): string {
  if (isApiError(e)) return e.status === 0 ? fallback : e.message || e.code
  if (e instanceof Error) return e.message
  return fallback
}
