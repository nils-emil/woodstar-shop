#!/bin/sh
# ops/deploy.sh <image-tag> — release. Runs ON THE SERVER as root (via sudo).
#
# 1. renders /opt/woodstar/.env from the environment the workflow passed in
# 2. makes sure the broker password file has the backend user with the current password
# 3. logs in to GHCR, pulls the tagged images, `compose up`
# 4. waits for the backend healthcheck and smoke-tests the public URL through Caddy
# 5. on failure, redeploys the previously live tag (recorded in current-tag) and exits 1
set -eu

APP_DIR="${APP_DIR:-/opt/woodstar}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-180}"
IMAGE_TAG="${1:?usage: deploy.sh <image-tag>}"
: "${IMAGE_PREFIX:?IMAGE_PREFIX is required (e.g. ghcr.io/owner)}"
: "${DOMAIN:?DOMAIN is required}"

cd "$APP_DIR"
log() { echo "==> $*"; }

# --- 1. .env ----------------------------------------------------------------
# Only rendered from the workflow's environment; nothing secret is stored in git.
render_env() {
    # Without Maksekeskus keys the shop runs with sales closed (provider "none"), never "fake".
    # DEMO_MODE=true (test servers only): mocked payments and mocked doors, for showing the shop.
    mqtt_enabled=true
    if [ "${DEMO_MODE:-false}" = true ]; then provider=fake; mqtt_enabled=false
    elif [ -n "${MAKSEKESKUS_SHOP_ID:-}" ] && [ -n "${MAKSEKESKUS_SECRET_KEY:-}" ]; then provider=maksekeskus
    else provider=none; fi
    umask 077
    cat > .env <<EOF
# Rendered by ops/deploy.sh on $(date -u +%FT%TZ). Do not edit by hand; change GitHub secrets/variables.
IMAGE_TAG=$1
IMAGE_PREFIX=$IMAGE_PREFIX
DOMAIN=$DOMAIN
SPRING_PROFILES_ACTIVE=prod
PUBLIC_BASE_URL=https://$DOMAIN
DB_USERNAME=woodstar
DB_PASSWORD=$DB_PASSWORD
ADMIN_USERNAME=${ADMIN_USERNAME:-admin}
ADMIN_PASSWORD=$ADMIN_PASSWORD
PAYMENTS_PROVIDER=$provider
DEMO_MODE=${DEMO_MODE:-false}
MAKSEKESKUS_SHOP_ID=${MAKSEKESKUS_SHOP_ID:-}
MAKSEKESKUS_SECRET_KEY=${MAKSEKESKUS_SECRET_KEY:-}
MAKSEKESKUS_BASE_URL=${MAKSEKESKUS_BASE_URL:-https://api.maksekeskus.ee/v1}
MQTT_ENABLED=$mqtt_enabled
MQTT_USERNAME=backend
MQTT_PASSWORD=$MQTT_PASSWORD
MQTT_PASSWD_FILE=./infra/mosquitto/passwd
SMTP_HOST=${SMTP_HOST:-}
SMTP_PORT=${SMTP_PORT:-587}
SMTP_USERNAME=${SMTP_USERNAME:-}
SMTP_PASSWORD=${SMTP_PASSWORD:-}
MAIL_FROM=${MAIL_FROM:-noreply@$DOMAIN}
PICKUP_DEADLINE_HOURS=${PICKUP_DEADLINE_HOURS:-48}
EOF
}

compose() { docker compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env "$@"; }

# --- 2. broker password file --------------------------------------------------
# `mosquitto_passwd -b` creates or updates one entry and leaves the Shelly users alone.
ensure_broker_user() {
    docker run --rm -v "$APP_DIR/infra/mosquitto/passwd:/tmp/passwd" eclipse-mosquitto:2 \
        mosquitto_passwd -b /tmp/passwd backend "$MQTT_PASSWORD" >/dev/null
    chmod 600 infra/mosquitto/passwd
    # a running broker re-reads the file on SIGHUP
    compose kill -s HUP mosquitto >/dev/null 2>&1 || true
}

# --- 4. checks --------------------------------------------------------------
wait_healthy() {
    deadline=$(( $(date +%s) + HEALTH_TIMEOUT ))
    while [ "$(date +%s)" -lt "$deadline" ]; do
        status=$(docker inspect --format '{{.State.Health.Status}}' "$(compose ps -q backend)" 2>/dev/null || echo starting)
        [ "$status" = healthy ] && return 0
        sleep 5
    done
    log "backend did not become healthy within ${HEALTH_TIMEOUT}s"
    compose logs --tail 80 backend || true
    return 1
}

smoke() {
    # Through Caddy + nginx + backend: proves TLS, routing and the DB in one call.
    for i in 1 2 3 4 5 6; do
        code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 15 "https://$DOMAIN/api/sites" || echo 000)
        [ "$code" = 200 ] && { log "smoke test OK (https://$DOMAIN/api/sites → 200)"; return 0; }
        log "smoke test attempt $i: HTTP $code (Caddy may still be fetching the certificate)"
        sleep 10
    done
    return 1
}

release() { # <tag>
    render_env "$1"
    log "pulling $IMAGE_PREFIX/woodstar-{backend,frontend}:$1"
    compose pull --quiet backend frontend
    compose up -d --remove-orphans --no-build
    wait_healthy && smoke
}

# --- run --------------------------------------------------------------------
previous=$(cat current-tag 2>/dev/null || true)
log "deploying $IMAGE_TAG (previous: ${previous:-none})"

echo "$GHCR_PAT" | docker login ghcr.io -u "${GH_ACTOR:-github}" --password-stdin >/dev/null
ensure_broker_user

if release "$IMAGE_TAG"; then
    echo "$IMAGE_TAG" > current-tag
    docker image prune -f >/dev/null 2>&1 || true
    log "release $IMAGE_TAG is live at https://$DOMAIN"
    exit 0
fi

if [ -n "$previous" ] && [ "$previous" != "$IMAGE_TAG" ]; then
    log "release failed, rolling back to $previous"
    if release "$previous"; then
        log "rolled back to $previous"
    else
        log "rollback to $previous also failed; site may be down"
    fi
else
    log "release failed and there is no previous tag to roll back to"
fi
exit 1
