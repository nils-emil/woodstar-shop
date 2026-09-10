#!/usr/bin/env sh
# Add or update an MQTT user (a Shelly device or the backend) in the broker password file.
#   infra/mosquitto/add-user.sh <username> <password> [passwd-file]
# Uses the mosquitto image so nothing has to be installed locally. Restart the broker
# afterwards (or `docker compose kill -s HUP mosquitto`) for it to reload the file.
set -eu
user="${1:?username}"; pass="${2:?password}"
file="${3:-$(dirname "$0")/passwd}"
[ -f "$file" ] || touch "$file"
docker run --rm -v "$(cd "$(dirname "$file")" && pwd)/$(basename "$file"):/tmp/passwd" \
  eclipse-mosquitto:2 mosquitto_passwd -b /tmp/passwd "$user" "$pass"
echo "updated $file for user $user"
