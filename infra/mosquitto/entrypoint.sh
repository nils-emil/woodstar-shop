#!/bin/sh
# Broker start-up. Device logins live in the Dynamic Security file, which the backend edits at
# runtime over $CONTROL/dynamic-security/v1 (admin → Devices). This script only makes sure the
# backend's own admin login exists and carries the current MQTT_PASSWORD, then starts mosquitto.
set -eu
file=/mosquitto/data/dynamic-security.json
: "${MQTT_USERNAME:?}" "${MQTT_PASSWORD:?}"

if [ ! -f "$file" ]; then
    echo "creating $file with admin user $MQTT_USERNAME"
    mosquitto_ctrl dynsec init "$file" "$MQTT_USERNAME" "$MQTT_PASSWORD" >/dev/null
else
    # Offline edit: lets a changed MQTT_PASSWORD take effect on the next container start.
    mosquitto_ctrl -f "$file" dynsec setClientPassword "$MQTT_USERNAME" "$MQTT_PASSWORD" >/dev/null
fi

exec /docker-entrypoint.sh mosquitto -c /mosquitto/config/mosquitto.conf
