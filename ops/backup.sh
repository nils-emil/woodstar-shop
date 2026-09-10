#!/bin/sh
# ops/backup.sh — nightly pg_dump into /opt/woodstar/backups, 14 days kept.
# Installed as a cron job by ops/bootstrap.sh. Restore with:
#   gunzip -c backups/woodstar-YYYY-MM-DD.sql.gz | docker compose exec -T db psql -U woodstar woodstar
set -eu
APP_DIR="${APP_DIR:-/opt/woodstar}"
KEEP_DAYS="${KEEP_DAYS:-14}"
cd "$APP_DIR"
out="backups/woodstar-$(date +%F).sql.gz"
docker compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env \
    exec -T db pg_dump -U woodstar --clean --if-exists woodstar | gzip > "$out.tmp"
mv "$out.tmp" "$out"
chmod 600 "$out"
find backups -name 'woodstar-*.sql.gz' -mtime "+$KEEP_DAYS" -delete
echo "$(date -u +%FT%TZ) wrote $out ($(du -h "$out" | cut -f1))"
