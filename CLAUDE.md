# Woodstar Shop — notes for Claude

Firewood locker vending: pay online → link opens a Shelly-controlled locker door over MQTT.
Read `docs/SPEC.md` before changing domain logic; it is the contract between backend and frontend.

## Layout
- `backend/` Spring Boot 3.5, Java 21, Gradle. Layered: `domain` (JPA entities), `repository`, `service`,
  `locker` (LockerController port: MQTT Shelly + fake), `payment` (PaymentGateway port: Maksekeskus + fake), `web`, `config`.
- `frontend/` single Vite/React/TS/Tailwind SPA: storefront `/`, pickup `/pickup/:token`, admin `/admin/*`.
- `infra/` Mosquitto + Caddy config. Compose files at repo root.

## Design system (frontend)
- Clean, light, premium: warm off-white canvas, white cards (`card`, `card-interactive`, `card-selected`), one burnt-orange accent (`accent-*`) used for the CTA (`btn-cta`), icons and selection only. Text uses the `ink` scale. Inter for UI, Fraunces (`font-display`) only for the hero headline and locker labels.
- Motion is quiet: `<Backdrop />` is two slowly drifting gradients plus a static line texture; entrance is `fade-up` with `--i` stagger; the open button uses `pulse-soft`; success uses the small `door` swing. No particles, grain, glass or neon. The user rejected a dark "campfire" look as unprofessional on 2026-09-10.
- Tokens, keyframes and surface classes live in `frontend/src/index.css`. Admin keeps a solid dark sidebar (`night-900`) with the same accent; content areas are light.

## Rules
- Locker and order state transitions live in the services only; controllers never mutate state directly.
- Every visible UI string goes through `t()` with both `et` and `en` keys in `frontend/src/i18n/`.
- Money is integer cents, prices include 24 % VAT. Timestamps are `Instant` / `TIMESTAMPTZ`.
- Never publish on Paho's callback thread. Relay commands are always pulses (`toggle_after`), never plain on.
- Schema changes are new Flyway migrations (`V<n>__snake_case.sql`); never edit an applied migration.

## Verify
- `cd backend && ./gradlew test` (Testcontainers → Docker must be running)
- `cd frontend && npm run build`
- Full stack: `docker compose up -d --build`, then storefront at http://localhost:3000, admin login admin/admin.
