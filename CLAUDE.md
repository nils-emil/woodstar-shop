# Woodstar Shop — notes for Claude

Firewood locker vending: pay online → link opens a Shelly-controlled locker door over MQTT.
Read `docs/SPEC.md` before changing domain logic; it is the contract between backend and frontend.

## Layout
- `backend/` Spring Boot 3.5, Java 21, Gradle. Layered: `domain` (JPA entities), `repository`, `service`,
  `locker` (LockerController port: MQTT Shelly + fake), `payment` (PaymentGateway port: Maksekeskus + fake), `web`, `config`.
- `frontend/` single Vite/React/TS/Tailwind SPA: storefront `/`, pickup `/pickup/:token`, admin `/admin/*`.
- `infra/` Mosquitto + Caddy config. Compose files at repo root.

## Design system (frontend)
- Simple and functional: it is a pay-to-buy shop, not a showcase. The user rejected an art-directed version (pinned hero card, passing photos, receipt/coupon sections) on 2026-10-15 as "an art show".
- Palette "Stone and blueprint": stone ground `canvas`, tone steps `surface` and `paper`, near-black `ink`, one blue `accent-600` for the primary action and selection only. One typeface: Schibsted Grotesk.
- Taste-skill house rules hold (`npx -y node@22 ~/.claude/skills/taste-skill/scripts/lint.mjs frontend/src` must stay at 0 FAIL): square corners, no shadows at rest (dialogs only), no gradients, no hairlines outside tables/form fields, no monospace, no uppercase tracked labels. Surfaces differ by tone, not lines. Avoid `tabular-nums` on prices/dates: it widens commas and colons in this face.
- Tokens, `.btn-*`, `.field`, `.head`/`.lead`/`.small` live in `frontend/src/index.css`. Admin keeps a solid `ink` sidebar with the accent on the active link.

## Rules
- Git: never create branches. Always commit and push directly on `main`.
- Locker and order state transitions live in the services only; controllers never mutate state directly.
- Every visible UI string goes through `t()` with both `et` and `en` keys in `frontend/src/i18n/`.
- Money is integer cents, prices include 24 % VAT. Timestamps are `Instant` / `TIMESTAMPTZ`.
- Never publish on Paho's callback thread. Relay commands are always pulses (`toggle_after`), never plain on.
- Shelly broker logins are created by the app (admin → Devices) via Mosquitto Dynamic Security; no hand-made password files.
- Schema changes are new Flyway migrations (`V<n>__snake_case.sql`); never edit an applied migration.

## Verify
- `cd backend && ./gradlew test` (Testcontainers → Docker must be running)
- `cd frontend && npm run build`
- Full stack: `docker compose up -d --build`, then storefront at http://localhost:3000, admin login admin/admin.
