# Deploying to Hetzner

Everything runs from GitHub Actions. There is no manual server setup beyond creating the
VM and a deploy user: `ops/bootstrap.sh` converges the host on every release.

## How it works

| Workflow | Trigger | What it does |
|---|---|---|
| **CI** | every push and pull request | backend build + tests (Testcontainers Postgres), frontend typecheck + build |
| **Deploy** | automatically after a green CI on `main`, or by hand | builds both images, pushes them to GHCR tagged with the commit SHA, copies the compose files to the server, runs `ops/bootstrap.sh` then `ops/deploy.sh` |

A release pulls the new images, restarts the containers, waits for the backend healthcheck,
then requests `https://<domain>/api/sites` through Caddy. If that fails, the previously
live tag is redeployed and the workflow fails. The last good tag lives in `/opt/woodstar/current-tag`.

**Rollback**: run the Deploy workflow by hand with `image_tag` set to an older commit SHA
(any SHA that was deployed before; the images are still in GHCR). No rebuild happens.

**Database**: Flyway migrates on startup. Migrations must stay backward compatible enough
that a failed release can roll back to the previous image without a schema downgrade.
A nightly `pg_dump` lands in `/opt/woodstar/backups` (14 days kept). Copy them off the box
with your Hetzner Storage Box or restic if the data matters; a VM disk is not a backup.

## 1. Server

- Hetzner Cloud, Ubuntu 24.04 (CX22 is plenty), Helsinki datacenter for lowest latency to Estonia.
- Add your SSH key when creating it. Then create the deploy user:

```bash
ssh root@<ip>
adduser --disabled-password --gecos "" deploy
mkdir -p /home/deploy/.ssh && cp ~/.ssh/authorized_keys /home/deploy/.ssh/ && chown -R deploy:deploy /home/deploy/.ssh
echo 'deploy ALL=(ALL) NOPASSWD:ALL' > /etc/sudoers.d/deploy
mkdir -p /opt/woodstar && chown deploy:deploy /opt/woodstar
```

- Generate a dedicated key pair for Actions and add its public half to `/home/deploy/.ssh/authorized_keys`:

```bash
ssh-keygen -t ed25519 -C woodstar-deploy -f woodstar-deploy   # keep the private key for the SSH_KEY secret
```

- DNS: an `A` record for your domain (and `AAAA` if the VM has IPv6) pointing at the server.
  Caddy fetches the Let's Encrypt certificate on the first release; the smoke test retries for a minute to allow for that.

## 2. GitHub settings

Repository → Settings → Secrets and variables → Actions.

**Secrets**

| Secret | Value |
|---|---|
| `SSH_USER` | `deploy` |
| `SSH_KEY` | private key generated above (full PEM text) |
| `GHCR_PAT` | a classic personal access token with `read:packages`, used by the server to pull images |
| `DB_PASSWORD` | strong random string |
| `ADMIN_PASSWORD` | initial admin password (seeded only when the admin table is empty) |
| `MQTT_PASSWORD` | strong random string for the backend's broker user |
| `MAKSEKESKUS_SHOP_ID` | from the Maksekeskus merchant portal |
| `MAKSEKESKUS_SECRET_KEY` | from the Maksekeskus merchant portal |
| `SMTP_USERNAME`, `SMTP_PASSWORD` | optional; without SMTP, pickup emails are only logged |

**Variables**

| Variable | Value |
|---|---|
| `PROD_HOST` | server IP or hostname |
| `DOMAIN` | e.g. `woodstar.ee` |
| `ADMIN_USERNAME` | optional, default `admin` |
| `SMTP_HOST`, `SMTP_PORT`, `MAIL_FROM` | optional |
| `MAKSEKESKUS_BASE_URL` | optional; set `https://api.test.maksekeskus.ee/v1` while testing with a test shop |
| `PICKUP_DEADLINE_HOURS` | optional, default 48 |

Create a `production` environment under Settings → Environments if you want a required
reviewer before each deploy; the deploy job already targets it.

## 3. First release

Push to `main` (or run **Deploy** by hand). The first run installs Docker, opens ports
22/80/443/1883 in ufw, writes the broker password file, pulls the images and starts
everything. Expect two to three minutes.

Then:

1. Open `https://<domain>/admin`, log in, create your site, products and lockers.
2. Point each Shelly at `<domain>:1883` with its own broker user (`docs/SHELLY.md`).
   Add users on the server with `infra/mosquitto/add-user.sh <deviceId> <password> infra/mosquitto/passwd`
   followed by `docker compose kill -s HUP mosquitto` from `/opt/woodstar`.
3. Stock a locker, buy it from your phone, open it.

## Operating

```bash
ssh deploy@<host>
cd /opt/woodstar
alias wc='sudo docker compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env'
wc ps
wc logs -f backend
wc exec db psql -U woodstar woodstar
sudo ops/backup.sh
```

Only 80, 443 and 1883 are reachable from outside. Postgres and the frontend container
listen on 127.0.0.1 only, so Docker's iptables rules cannot expose them past ufw.
Consider restricting 1883 to the locker sites' IPs in ufw once they are known.
