export type Locale = 'et' | 'en'

export type LockerState = 'EMPTY' | 'STOCKED' | 'RESERVED' | 'SOLD' | 'OUT_OF_ORDER'
export type OrderState = 'PENDING_PAYMENT' | 'PAID' | 'PICKED_UP' | 'EXPIRED' | 'CANCELLED' | 'REFUNDED'
export type LockerEventType =
  | 'OPEN_REQUESTED'
  | 'OPEN_CONFIRMED'
  | 'OPEN_FAILED'
  | 'STOCKED'
  | 'EMPTIED'
  | 'STATE_CHANGED'
export type CannotOpenReason = 'NOT_PAID' | 'EXPIRED' | 'REOPEN_WINDOW_CLOSED' | 'TOO_MANY_OPENS'

// ---- public ----

export interface PublicProduct {
  id: string
  nameEt: string
  nameEn: string
  descriptionEt: string | null
  descriptionEn: string | null
  priceCents: number
  available: number
}

export interface PublicSite {
  id: string
  name: string
  address: string
  lat: number | null
  lng: number | null
  products: PublicProduct[]
}

export interface CreateOrderRequest {
  siteId: string
  productId: string
  email: string
  phone?: string
  locale: Locale
}

export interface CreateOrderResponse {
  orderId: string
  checkoutUrl: string
}

export interface PublicOrder {
  id: string
  orderNumber: string
  state: OrderState
  siteName: string
  siteAddress: string
  lockerLabel: string
  productName: string
  priceCents: number
  pickupToken?: string | null
  pickupDeadline: string | null
}

export interface PickupInfo {
  orderNumber: string
  state: OrderState
  siteName: string
  siteAddress: string
  lockerLabel: string
  productName: string
  pickupDeadline: string | null
  canOpen: boolean
  cannotOpenReason?: CannotOpenReason | null
  opensRemaining: number
  deviceOnline: boolean
}

export interface OpenResult {
  ok: boolean
  opensRemaining: number
}

// ---- admin ----

export interface AdminMe {
  username: string
}

export interface DashboardSite {
  siteId: string
  siteName: string
  stocked: number
  reserved: number
  sold: number
  empty: number
  outOfOrder: number
  offlineDevices: number
}

export interface Dashboard {
  sites: DashboardSite[]
  ordersToday: number
  revenueTodayCents: number
  paidAwaitingPickup: number
  overduePickups: number
}

export interface AdminSite {
  id: string
  name: string
  address: string
  lat: number | null
  lng: number | null
  active: boolean
}

export interface SiteInput {
  name: string
  address: string
  lat: number | null
  lng: number | null
  active: boolean
}

export interface AdminProduct {
  id: string
  nameEt: string
  nameEn: string
  descriptionEt: string | null
  descriptionEn: string | null
  priceCents: number
  active: boolean
  sortOrder: number
}

export interface ProductInput {
  nameEt: string
  nameEn: string
  descriptionEt: string | null
  descriptionEn: string | null
  priceCents: number
  active: boolean
  sortOrder: number
}

export interface AdminLocker {
  id: string
  siteId: string
  label: string
  shellyDeviceId: string
  relayChannel: number
  pulseSeconds: number
  state: LockerState
  productId: string | null
  productName: string | null
  stockedAt: string | null
  note: string | null
  online: boolean
  currentOrderId: string | null
  currentOrderNumber: string | null
}

export interface LockerInput {
  siteId: string
  label: string
  shellyDeviceId: string
  relayChannel: number
  pulseSeconds: number
  note: string | null
}

export interface LockerEvent {
  id: string
  lockerId: string
  orderId: string | null
  type: LockerEventType
  detail: string | null
  createdAt: string
}

export interface AdminOrder {
  id: string
  orderNumber: string
  state: OrderState
  siteName: string
  lockerLabel: string
  productName: string
  priceCents: number
  email: string
  phone: string | null
  createdAt: string
  paidAt: string | null
  pickupDeadline: string | null
  pickedUpAt: string | null
  openCount: number
}

export interface AdminOrderDetail extends AdminOrder {
  events: LockerEvent[]
}

export interface AdminDevice {
  deviceId: string
  online: boolean
  lockers: { id: string; label: string; siteName: string }[]
  loginIssuedAt: string | null
}

/** Returned once when a device login is created or its password replaced. */
export interface DeviceLogin {
  deviceId: string
  server: string
  username: string
  password: string
  live: boolean
}

export interface OrderFilters {
  state?: OrderState | ''
  siteId?: string
  q?: string
}
