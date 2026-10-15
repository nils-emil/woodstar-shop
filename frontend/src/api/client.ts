import type {
  AdminDevice,
  AdminLocker,
  AdminMe,
  AdminOrder,
  AdminOrderDetail,
  AdminProduct,
  AdminSite,
  CreateOrderRequest,
  CreateOrderResponse,
  Dashboard,
  LockerEvent,
  LockerInput,
  OpenResult,
  OrderFilters,
  PickupInfo,
  ProductInput,
  PublicOrder,
  PublicSite,
  SiteInput,
} from './types'

export class ApiError extends Error {
  status: number
  code: string
  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(path, {
      method,
      credentials: 'include',
      headers: body !== undefined ? { 'Content-Type': 'application/json', Accept: 'application/json' } : { Accept: 'application/json' },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError(0, 'NETWORK', 'Network error')
  }
  if (!res.ok) {
    let code = 'HTTP_' + res.status
    let message = res.statusText
    try {
      const data = (await res.json()) as { error?: string; message?: string }
      if (data.error) code = data.error
      if (data.message) message = data.message
    } catch {
      /* non-JSON body */
    }
    throw new ApiError(res.status, code, message)
  }
  if (res.status === 204) return undefined as T
  const text = await res.text()
  return (text ? JSON.parse(text) : undefined) as T
}

const get = <T>(path: string) => request<T>('GET', path)
const post = <T>(path: string, body?: unknown) => request<T>('POST', path, body ?? {})
const put = <T>(path: string, body: unknown) => request<T>('PUT', path, body)

function qs(params: Record<string, string | undefined>): string {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v) p.set(k, v)
  const s = p.toString()
  return s ? `?${s}` : ''
}

// ---- public ----
export const api = {
  sites: () => get<PublicSite[]>('/api/sites'),
  status: () => get<{ salesOpen: boolean }>('/api/status'),
  createOrder: (req: CreateOrderRequest) => post<CreateOrderResponse>('/api/orders', req),
  order: (id: string) => get<PublicOrder>(`/api/orders/${encodeURIComponent(id)}`),
  pickup: (token: string) => get<PickupInfo>(`/api/pickup/${encodeURIComponent(token)}`),
  pickupOpen: (token: string) => post<OpenResult>(`/api/pickup/${encodeURIComponent(token)}/open`),
}

// ---- admin ----
export const admin = {
  login: (username: string, password: string) => post<AdminMe>('/api/admin/login', { username, password }),
  logout: () => post<void>('/api/admin/logout'),
  me: () => get<AdminMe>('/api/admin/me'),
  dashboard: () => get<Dashboard>('/api/admin/dashboard'),

  sites: () => get<AdminSite[]>('/api/admin/sites'),
  createSite: (input: SiteInput) => post<AdminSite>('/api/admin/sites', input),
  updateSite: (id: string, input: SiteInput) => put<AdminSite>(`/api/admin/sites/${id}`, input),

  products: () => get<AdminProduct[]>('/api/admin/products'),
  createProduct: (input: ProductInput) => post<AdminProduct>('/api/admin/products', input),
  updateProduct: (id: string, input: ProductInput) => put<AdminProduct>(`/api/admin/products/${id}`, input),

  lockers: (siteId?: string) => get<AdminLocker[]>(`/api/admin/lockers${qs({ siteId })}`),
  createLocker: (input: LockerInput) => post<AdminLocker>('/api/admin/lockers', input),
  updateLocker: (id: string, input: LockerInput) => put<AdminLocker>(`/api/admin/lockers/${id}`, input),
  stockLocker: (id: string, productId: string) => post<AdminLocker>(`/api/admin/lockers/${id}/stock`, { productId }),
  emptyLocker: (id: string) => post<AdminLocker>(`/api/admin/lockers/${id}/empty`),
  setOutOfOrder: (id: string, outOfOrder: boolean) =>
    post<AdminLocker>(`/api/admin/lockers/${id}/out-of-order`, { outOfOrder }),
  openLocker: (id: string) => post<{ ok: boolean }>(`/api/admin/lockers/${id}/open`),
  lockerEvents: (id: string) => get<LockerEvent[]>(`/api/admin/lockers/${id}/events`),

  orders: (f: OrderFilters = {}) => get<AdminOrder[]>(`/api/admin/orders${qs({ state: f.state, siteId: f.siteId, q: f.q })}`),
  order: (id: string) => get<AdminOrderDetail>(`/api/admin/orders/${id}`),
  cancelOrder: (id: string) => post<AdminOrder>(`/api/admin/orders/${id}/cancel`),
  resendEmail: (id: string) => post<void>(`/api/admin/orders/${id}/resend-email`),

  devices: () => get<AdminDevice[]>('/api/admin/devices'),
}
