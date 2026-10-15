# Woodstar Shop — system spec (v1)

Self-service firewood lockers, modelled on Alexela's gas-bottle lockers.
A customer picks a site and a product on their phone, pays online, and gets a
link that opens one locker door. Lockers have no screen or buttons; every door
is a relay on a Shelly (Gen2+) device controlled over MQTT. Admins stock lockers,
watch inventory, see orders, and open doors manually.

Estonia only: EUR, 24 % VAT included in prices, UI in Estonian (default) and English.

## Repository layout

```
backend/    Spring Boot 3.5, Java 21, Gradle (Groovy DSL), Postgres 16, Flyway, JPA
frontend/   Vite 6 + React 19 + TypeScript + Tailwind v4, single SPA (storefront + admin)
infra/      docker-compose, Mosquitto config, Caddy, Dockerfiles live next to each app
docs/       this spec, Shelly setup guide
```

Java base package: `ee.woodstar.shop`. Package layout (simple layered, not full hexagonal):

```
ee.woodstar.shop
  domain/        JPA entities + enums (Site, Product, Locker, Order, LockerEvent, AdminUser)
  repository/    Spring Data repositories
  service/       OrderService, PickupService, InventoryService, AdminUserService, MailService
  locker/        LockerController port + MqttShellyLockerController + FakeLockerController
  payment/       PaymentGateway port + MaksekeskusPaymentGateway + FakePaymentGateway
  web/           REST controllers (public, pickup, webhook, admin) + DTOs + error handling
  config/        Security, properties, Clock bean, scheduling
```

## Domain model (Flyway V1)

All ids are UUID (generated in Java, `UUID.randomUUID()`), all timestamps `TIMESTAMPTZ` / `Instant`.

- `site`: id, name, address, lat (nullable), lng (nullable), active bool, created_at
- `product`: id, name_et, name_en, description_et, description_en, price_cents int, active bool, sort_order int, created_at
- `locker`: id, site_id FK, label (e.g. "A1"), shelly_device_id (e.g. `shellyplus1-a8032abcdef0`), relay_channel int default 0, pulse_seconds int default 2, state enum, product_id FK nullable, stocked_at nullable, note text nullable, updated_at. UNIQUE(site_id, label).
  - state: `EMPTY`, `STOCKED`, `RESERVED`, `SOLD`, `OUT_OF_ORDER`
- `orders`: id, order_number (human readable, e.g. `WS-2026-000123`, unique, sequence-backed), site_id, locker_id, product_id, product_name (snapshot, in the buyer's locale), price_cents, email, phone nullable, locale (`et`/`en`), state enum, pickup_token (unique, 32 url-safe random chars), payment_provider (`maksekeskus`/`fake`), payment_ref nullable (Maksekeskus transaction id), created_at, paid_at nullable, pickup_deadline nullable, picked_up_at nullable, first_open_at nullable, open_count int default 0
  - state: `PENDING_PAYMENT`, `PAID`, `PICKED_UP`, `EXPIRED`, `CANCELLED`, `REFUNDED`
- `locker_event`: id, locker_id, order_id nullable, type, detail text nullable, created_at
  - type: `OPEN_REQUESTED`, `OPEN_CONFIRMED`, `OPEN_FAILED`, `STOCKED`, `EMPTIED`, `STATE_CHANGED`
- `admin_user`: id, username unique, password_hash (bcrypt), created_at

## Locker lifecycle

```
EMPTY --(admin stock)--> STOCKED --(order created)--> RESERVED --(paid)--> SOLD --(door opened)--> EMPTY
                                        |                                     
                                        +--(reservation expired 15 min, unpaid)--> STOCKED
OUT_OF_ORDER can be set/cleared by admin from EMPTY/STOCKED only.
Admin can also resolve a SOLD locker whose bag was not collected through the link:
- "Mark emptied": SOLD → EMPTY, the PAID order → PICKED_UP (`picked_up_at = now`, `first_open_at` stays null,
  so the link can no longer open the door: `REOPEN_WINDOW_CLOSED`).
- "Mark stocked again": SOLD → STOCKED (product chosen by admin, `stocked_at = now`), the PAID order → EXPIRED
  without a refund (refunds go through cancelling the order).
```

Locker allocation when an order is created: pick the STOCKED locker at the site
with the requested product and the oldest `stocked_at` (FIFO), using
`SELECT ... FOR UPDATE SKIP LOCKED` so two concurrent buyers never get the same locker.
If none is available → HTTP 409 `{"error":"SOLD_OUT"}`.

## Order lifecycle

1. `POST /api/orders` → reserve locker, create order `PENDING_PAYMENT`, create checkout with the
   payment gateway, return `{orderId, checkoutUrl}`. Frontend redirects to `checkoutUrl`.
2. Payment gateway confirms (Maksekeskus notification with status `COMPLETED`, or the fake gateway's
   redirect) → `OrderService.markPaid(orderId, paymentRef)`: order `PAID`, `paid_at=now`,
   `pickup_deadline = now + woodstar.pickup.deadline (default 48h)`, locker `SOLD`, send pickup email.
   Must be idempotent (second call is a no-op).
3. Customer opens `/pickup/{token}` and presses Open → `PickupService.open(token)`:
   - allowed when order is `PAID`, or `PICKED_UP` and `now < first_open_at + woodstar.pickup.reopen-window (default 30m)`
     and `open_count < woodstar.pickup.max-opens (default 5)`. Otherwise 409 with a reason code
     (`NOT_PAID`, `EXPIRED`, `REOPEN_WINDOW_CLOSED`, `TOO_MANY_OPENS`).
   - record `OPEN_REQUESTED`, call `LockerController.open(deviceId, channel, pulseSeconds)` which blocks
     up to 5 s for the device's RPC acknowledgement.
   - on success: `OPEN_CONFIRMED`; if first open → order `PICKED_UP`, `picked_up_at`, `first_open_at`, locker `EMPTY`, `product_id=null`.
     `open_count++`. Response `{ok:true}`.
   - on failure (timeout / device offline / broker down): `OPEN_FAILED` with detail, order unchanged, 503 `{"error":"DEVICE_UNREACHABLE"}`.
4. Scheduled job every minute: orders `PENDING_PAYMENT` older than `woodstar.order.reservation-ttl` (15m)
   → `EXPIRED`, locker back to `STOCKED`. Orders `PAID` past `pickup_deadline` are NOT auto-expired in v1
   (admin decides); they simply show as overdue in admin.
5. Admin cancel: `PENDING_PAYMENT` → `CANCELLED` + locker `STOCKED`; `PAID` → refund via gateway → `REFUNDED` + locker `STOCKED`.

## MQTT / Shelly contract (Gen2+ RPC)

Config prefix `woodstar.mqtt`: `enabled`, `host`, `port` (1883), `username`, `password`, `tls` (false), `client-id-prefix` (`woodstar-backend`).
Use `org.eclipse.paho:org.eclipse.paho.client.mqttv3:1.2.5`, automatic reconnect, clean session.

- Each Shelly is configured with MQTT prefix = its device id (Shelly default) and RPC over MQTT enabled.
- Open command: publish to `<deviceId>/rpc`:
  `{"id":<n>,"src":"woodstar-backend","method":"Switch.Set","params":{"id":<channel>,"on":true,"toggle_after":<pulseSeconds>}}`
- Response arrives on `woodstar-backend/rpc` as `{"id":<n>,"src":"<deviceId>","dst":"woodstar-backend","result":{"was_on":false}}` or `{"id":<n>, ..., "error":{"code":..,"message":".."}}`.
  Correlate by `id` with a `CompletableFuture`; timeout 5 s → failure.
- Online tracking: subscribe `+/online`, payload `true`/`false` (retained). Expose `isOnline(deviceId)`.
- On connect, for every locker publish `Switch.SetConfig` with `initial_state: "off"` and `auto_off` disabled so a power-cycled relay never leaves a door unlocked.
- `LockerController` port:
  ```java
  public interface LockerController {
      OpenResult open(String deviceId, int channel, int pulseSeconds); // blocks ≤ 5s
      boolean isOnline(String deviceId);
      record OpenResult(boolean ok, String detail) {}
  }
  ```
- `FakeLockerController` (active when `woodstar.mqtt.enabled=false`): always online, returns ok after 300 ms, except device ids containing `offline` (reports offline + fails) — used by tests and local demo.

## Payment contract

`woodstar.payments.provider` = `none` (default: sales closed, `POST /api/orders` → 503 `SALES_CLOSED`) | `maksekeskus` | `fake` (dev only; the app refuses to start with `fake` under the `prod` profile). `ops/deploy.sh` sets `maksekeskus` when both keys are present, else `none`.

```java
public interface PaymentGateway {
    String createCheckout(Order order, String successUrl, String cancelUrl, String customerIp); // returns URL to redirect to
    void refund(Order order);
}
```

- Maksekeskus (MakeCommerce): `POST {baseUrl}/transactions` with HTTP Basic auth `shopId:secretKey`, body
  `{transaction: {amount "12.00", currency EUR, reference orderNumber, merchant_data orderId, transaction_url: {return_url GET, cancel_url GET, notification_url POST}}, customer: {ip, email, country "ee", locale}}`.
  Store the returned `id` in `payment_ref`; redirect to `payment_methods.other[name=redirect].url` (the hosted page where the
  buyer picks a bank link or card). Notification `POST /api/webhooks/maksekeskus` arrives as form fields `json` + `mac`;
  `mac` must equal upper-case hex SHA-512 of `json + secretKey`. Only status `COMPLETED` with an amount equal to the order price
  calls `markPaid(merchant_data, transaction)`; `CANCELLED`/`EXPIRED` are ignored (the reservation-expiry job releases the locker).
  Refund: `POST {baseUrl}/refunds` `{transaction, amount, comment}`. Test environment base URL: `https://api.test.maksekeskus.ee/v1`.
- Fake: `createCheckout` returns `<publicBaseUrl>/api/dev/pay/{orderId}`; `GET /api/dev/pay/{orderId}` (only when provider=fake)
  calls `markPaid` and redirects (302) to the success URL. `refund` is a no-op.
- success URL: `<publicBaseUrl>/order/{orderId}`, cancel URL: `<publicBaseUrl>/?cancelled=1`.

## Email

`spring-boot-starter-mail`. If `SMTP_HOST` is empty, `MailService` logs the message at INFO instead of sending.
One message: pickup email (et/en per order locale) containing site name + address, locker label, product,
the pickup link `<publicBaseUrl>/pickup/{token}`, and the deadline.

## Public REST API (no auth)

Errors: `{"error": "<CODE>", "message": "<human>"}` with 400/404/409/503.

- `GET /api/sites` → `[{id, name, address, lat, lng, products:[{id, nameEt, nameEn, descriptionEt, descriptionEn, priceCents, available}]}]`
  Only active sites/products; `available` = STOCKED locker count for that product at the site.
- `GET /api/status` → `{salesOpen}` (false while no payment provider is configured)
- `POST /api/orders` `{siteId, productId, email, phone?, locale}` → `201 {orderId, checkoutUrl}` / `409 SOLD_OUT`
- `GET /api/orders/{id}` → `{id, orderNumber, state, siteName, siteAddress, lockerLabel, productName, priceCents, pickupToken (only when state is PAID or PICKED_UP), pickupDeadline}`
- `GET /api/pickup/{token}` → `{orderNumber, state, siteName, siteAddress, lockerLabel, productName, pickupDeadline, canOpen, cannotOpenReason?, opensRemaining, deviceOnline}`
- `POST /api/pickup/{token}/open` → `200 {ok:true, opensRemaining}` / `409 {error: reason}` / `503 DEVICE_UNREACHABLE`
- `POST /api/webhooks/maksekeskus` (form fields `json` + `mac`)
- `GET /api/dev/pay/{orderId}` (fake provider only)

## Admin REST API (session cookie, Spring Security)

- `POST /api/admin/login` `{username, password}` → 200 `{username}` / 401; `POST /api/admin/logout`; `GET /api/admin/me` → `{username}` / 401.
  Admin user seeded at startup from `ADMIN_USERNAME` / `ADMIN_PASSWORD` env if the table is empty.
  CSRF disabled (SPA, same-origin, SameSite=Lax cookie). Everything under `/api/admin/**` except login requires auth.
- `GET /api/admin/dashboard` → `{sites:[{siteId, siteName, stocked, reserved, sold, empty, outOfOrder, offlineDevices}], ordersToday, revenueTodayCents, paidAwaitingPickup, overduePickups}`
- Sites: `GET /api/admin/sites`, `POST /api/admin/sites`, `PUT /api/admin/sites/{id}` — body `{name, address, lat, lng, active}`
- Products: `GET /api/admin/products`, `POST`, `PUT /{id}` — body `{nameEt, nameEn, descriptionEt, descriptionEn, priceCents, active, sortOrder}`
- Lockers: `GET /api/admin/lockers?siteId=` → `[{id, siteId, label, shellyDeviceId, relayChannel, pulseSeconds, state, productId, productName, stockedAt, note, online, currentOrderId, currentOrderNumber}]`
  `POST /api/admin/lockers` / `PUT /{id}` body `{siteId, label, shellyDeviceId, relayChannel, pulseSeconds, note}`
  `POST /api/admin/lockers/{id}/stock` `{productId}` (EMPTY→STOCKED), `POST /{id}/empty` (STOCKED→EMPTY),
  `POST /{id}/out-of-order` `{outOfOrder: bool}`, `POST /{id}/open` (manual open, any state, logs event with detail "admin:<username>")
  `GET /api/admin/lockers/{id}/events` → last 100 events
- Orders: `GET /api/admin/orders?state=&siteId=&q=` (newest first, limit 200) → `[{id, orderNumber, state, siteName, lockerLabel, productName, priceCents, email, phone, createdAt, paidAt, pickupDeadline, pickedUpAt, openCount}]`
  `GET /api/admin/orders/{id}` (same + events), `POST /{id}/cancel`, `POST /{id}/resend-email`
- `GET /api/admin/devices` → `[{deviceId, online, lockers:[{id,label,siteName}]}]`

## Config / env vars

| Env | Property | Default (dev) |
|---|---|---|
| `SPRING_PROFILES_ACTIVE` | | `dev` |
| `DB_URL`, `DB_USERNAME`, `DB_PASSWORD` | `spring.datasource.*` | `jdbc:postgresql://localhost:5432/woodstar`, `woodstar`, `woodstar` |
| `PUBLIC_BASE_URL` | `woodstar.public-base-url` | `http://localhost:3000` |
| `ADMIN_USERNAME`, `ADMIN_PASSWORD` | `woodstar.admin.*` | `admin`, `admin` |
| `PAYMENTS_PROVIDER` | `woodstar.payments.provider` | `fake` |
| `MAKSEKESKUS_SHOP_ID`, `MAKSEKESKUS_SECRET_KEY`, `MAKSEKESKUS_BASE_URL` | `woodstar.payments.maksekeskus.*` | empty, empty, `https://api.maksekeskus.ee/v1` |
| `MQTT_ENABLED`, `MQTT_HOST`, `MQTT_PORT`, `MQTT_USERNAME`, `MQTT_PASSWORD` | `woodstar.mqtt.*` | `false`, `localhost`, `1883`, `backend`, `backend` |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `MAIL_FROM` | `spring.mail.*`, `woodstar.mail.from` | empty → log only |
| `PICKUP_DEADLINE_HOURS` | `woodstar.pickup.deadline-hours` | 48 |

`dev` profile additionally seeds demo data if the `site` table is empty: products "Kuivad kaseklotsid 40 L"
(1200 c) and "Segapuu 40 L" (900 c), and two sites:
- "Lillemäe" (Lillemäe, Paatna, 44411 Lääne-Viru maakond): lockers A1..A6, device ids `shellyplus1-dev0001`..`dev0006`,
  A1–A3 stocked with product 1, A4–A5 with product 2, A6 EMPTY.
- "Rakvere Põhjakeskus" (Põhjakeskus, Rakvere): lockers A1..A4, device ids `shellyplus1-dev0101`..`dev0104`,
  A1–A2 stocked with product 1, A3 with product 2, A4 EMPTY.

## Frontend routes

- `/` storefront: choose site → choose product (shows availability, price) → email + phone → Buy. `?cancelled=1` shows a notice.
- `/order/:id` post-checkout: polls `GET /api/orders/{id}` every 2 s until PAID/PICKED_UP; shows locker + big "Open locker" link to `/pickup/:token`.
- `/pickup/:token` big "Open locker" button; shows site address, locker label, remaining opens, deadline; error states.
- `/admin/login`, `/admin` (dashboard), `/admin/lockers` (per-site grid of locker tiles coloured by state, click → drawer with stock/empty/out-of-order/open/events), `/admin/orders`, `/admin/products`, `/admin/sites`, `/admin/devices`.
- Language toggle et/en, persisted in localStorage, Estonian default. Every visible string goes through `t()`.
