#!/bin/sh
# ops/bootstrap.sh — converge a Hetzner Ubuntu/Debian host. Runs ON THE SERVER as root
# (via sudo) on every deploy; every step is idempotent, so a fresh box and a
# box that has seen a hundred releases end up identical.
#
# Does: Docker Engine + compose plugin, ufw (22/80/443/1883), /opt/woodstar layout,
# nightly Postgres backup cron, unattended security upgrades.
set -eu

APP_DIR="${APP_DIR:-/opt/woodstar}"

log() { echo "==> $*"; }

# --- Docker -----------------------------------------------------------------
if ! command -v docker >/dev/null 2>&1; then
    log "installing Docker Engine"
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -qq
    apt-get install -y -qq ca-certificates curl gnupg >/dev/null
    install -m 0755 -d /etc/apt/keyrings
    . /etc/os-release
    curl -fsSL "https://download.docker.com/linux/$ID/gpg" | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/$ID $VERSION_CODENAME stable" \
        > /etc/apt/sources.list.d/docker.list
    apt-get update -qq
    apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin >/dev/null
    systemctl enable --now docker
fi
docker compose version >/dev/null 2>&1 || { echo "docker compose plugin missing" >&2; exit 1; }

# Let the deploy user run docker without sudo next time.
if [ -n "${SUDO_USER:-}" ] && ! id -nG "$SUDO_USER" | grep -qw docker; then
    usermod -aG docker "$SUDO_USER"
fi

# Keep container logs bounded.
if [ ! -f /etc/docker/daemon.json ]; then
    cat > /etc/docker/daemon.json <<'EOF'
{ "log-driver": "json-file", "log-opts": { "max-size": "20m", "max-file": "5" } }
EOF
    systemctl restart docker
fi

# --- Firewall ---------------------------------------------------------------
# Docker publishes ports straight through iptables and bypasses ufw, which is
# why docker-compose.yml binds Postgres and the frontend to 127.0.0.1 only.
# ufw still protects everything that is not a published container port.
if command -v ufw >/dev/null 2>&1; then
    ufw allow 22/tcp >/dev/null
    ufw allow 80/tcp >/dev/null
    ufw allow 443/tcp >/dev/null
    ufw allow 443/udp >/dev/null
    ufw allow 1883/tcp comment 'MQTT (Shelly devices)' >/dev/null
    ufw --force enable >/dev/null
fi

# --- Unattended security upgrades ------------------------------------------
if [ ! -f /etc/apt/apt.conf.d/20auto-upgrades ]; then
    export DEBIAN_FRONTEND=noninteractive
    apt-get install -y -qq unattended-upgrades >/dev/null
    cat > /etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
EOF
fi

# --- Layout -----------------------------------------------------------------
mkdir -p "$APP_DIR/infra/mosquitto" "$APP_DIR/infra/caddy" "$APP_DIR/backups" "$APP_DIR/ops"
chmod 700 "$APP_DIR/backups"
touch "$APP_DIR/infra/mosquitto/passwd"
chmod 600 "$APP_DIR/infra/mosquitto/passwd"

# --- Nightly backup ---------------------------------------------------------
cat > /etc/cron.d/woodstar-backup <<EOF
# Nightly Postgres dump, 14 days kept. Installed by ops/bootstrap.sh.
15 3 * * * root APP_DIR=$APP_DIR $APP_DIR/ops/backup.sh >> /var/log/woodstar-backup.log 2>&1
EOF
chmod 644 /etc/cron.d/woodstar-backup

log "host converged"
