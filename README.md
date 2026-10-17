# Woodstar Shop

Self-service firewood lockers. A customer picks a site and a bag of firewood on their
phone, pays online, and gets a link that opens one locker door. The doors are relays on
Shelly devices driven over MQTT. Admins stock lockers, watch inventory, see orders and
open doors manually.

- `docs/SPEC.md` — domain model, lifecycles, REST API, MQTT and payment contracts
- `docs/SHELLY.md` — wiring a Shelly to a locker and registering it

## Stack

Spring Boot 3.5 / Java 21 / Postgres 16 / Flyway / Paho MQTT / Maksekeskus payments ·
Vite + React 19 + TypeScript + Tailwind v4 · Docker Compose · Mosquitto · Caddy (prod TLS)

## Run the whole thing in Docker

```bash
cp .env.example .env
docker compose up -d --build
open http://localhost:3000            # storefront
open http://localhost:3000/admin      # admin, login admin / admin
```

The `dev` profile seeds one site, two products and six lockers, uses the **fake payment
gateway** (checkout is a one-click "pay" page) and connects to the bundled Mosquitto.
Without a real Shelly, opening a door times out after 5 s and shows the retry state.
Set `MQTT_ENABLED=false` in `.env` to use the fake locker controller that always succeeds.

## Local development

```bash
docker compose up -d db mosquitto          # infra only
cd backend && ./gradlew bootRun            # http://localhost:8080, profile dev, fake lockers + fake payments
# if Gradle complains about JAVA_HOME: export JAVA_HOME=$(/usr/libexec/java_home -v 21)
cd frontend && npm install && npm run dev  # http://localhost:3000, proxies /api to 8080
```

Tests:

```bash
cd backend && ./gradlew test        # needs Docker (Testcontainers Postgres)
cd frontend && npm run build        # type-check + bundle
```

## Buying flow

1. `/` — choose site → product (shows how many bags are in stock) → email → **Buy**
2. Redirect to the Maksekeskus payment page: Estonian bank links or card (or the fake pay page in dev)
3. `/order/:id` — waits for payment confirmation, then links to the pickup page; the same link is emailed
4. `/pickup/:token` — one big **Open locker** button. Up to 5 opens within 30 minutes of the first,
   so a door that swung shut can be reopened. Pickup deadline 48 h (`PICKUP_DEADLINE_HOURS`)

## Deployment

GitHub Actions builds, tests and deploys to a Hetzner VM on every push to `main`; rollback is a
manual run of the Deploy workflow with an older image tag. Setup and secrets: `docs/DEPLOY.md`.

## Going to production (manual alternative)

1. `.env`: `SPRING_PROFILES_ACTIVE=prod`, real `DB_PASSWORD`, `ADMIN_PASSWORD`, `PUBLIC_BASE_URL=https://<domain>`, `DOMAIN=<domain>`
2. `PAYMENTS_PROVIDER=maksekeskus`, `MAKSEKESKUS_SHOP_ID` and `MAKSEKESKUS_SECRET_KEY` from the Maksekeskus merchant portal.
   The notification URL `https://<domain>/api/webhooks/maksekeskus` is sent with every transaction, nothing to register.
   For the Maksekeskus test environment set `MAKSEKESKUS_BASE_URL=https://api.test.maksekeskus.ee/v1` with test-shop credentials
3. MQTT: a strong `MQTT_PASSWORD` (the broker applies it on start). Shelly logins are created in admin → Devices (`docs/SHELLY.md`)
4. SMTP settings so pickup links are actually emailed
5. `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build`

Port 1883 must be reachable from the locker sites (firewall to their IPs, or put the
devices on a VPN). Do not expose Postgres.
