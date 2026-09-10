# Shelly setup for a locker

Each locker door is an electric strike or solenoid lock wired to one relay output of a
Shelly Gen2+ device (Shelly Plus 1, Plus 1PM, Pro 1, Pro 2, Pro 4PM ...). A Pro 4PM
drives four doors from one device: channels 0–3. The backend pulses the relay for
`pulse_seconds` (default 2 s) using `Switch.Set` with `toggle_after`, so a door can
never be left powered open by a dropped connection.

## 1. Broker user for the device

Every device gets its own MQTT username/password. Use the device id (shown in the
Shelly web UI under *Settings → Device info*, e.g. `shellyplus1-a8032abcdef0`) as the username:

```bash
infra/mosquitto/add-user.sh shellyplus1-a8032abcdef0 'a-long-random-password' infra/mosquitto/passwd
docker compose kill -s HUP mosquitto     # reload the password file
```

On a fresh production install create the backend user too:

```bash
infra/mosquitto/add-user.sh backend "$MQTT_PASSWORD" infra/mosquitto/passwd
```

and point `MQTT_PASSWD_FILE=./infra/mosquitto/passwd` in `.env`.

## 2. Shelly MQTT settings

In the Shelly web UI (or app) → *Settings → MQTT*:

| Setting | Value |
|---|---|
| Enable MQTT | on |
| Server | `<your-host>:1883` |
| Client ID / MQTT prefix | leave as the device id (default) |
| Username / Password | as created above |
| Enable RPC over MQTT | **on** |
| RPC status notifications | on |
| Generic status update over MQTT | on |

Save and reboot. The device publishes a retained `true` to `<deviceId>/online`, which is
what the admin *Devices* page and the pickup page use for the online indicator.

## 3. Relay settings

*Settings → Input/Output → Output settings*:

- Power-on default: **Off**
- Auto-off: **off** (the backend sends the pulse length itself)
- Detached input mode if the physical input is unused

The backend also pushes `initial_state: "off"` over `Switch.SetConfig` every time it connects
to the broker, so a mis-configured device is corrected automatically.

## 4. Register the locker in admin

Admin → Lockers → *Add locker*: site, label (what is printed on the door, e.g. `A3`),
device id, relay channel (0 for single-relay devices), pulse seconds. The tile shows a
green dot once the device is online.

Test with *Open door* from the locker panel. The event list underneath records every
request and whether the device acknowledged it.

## Topics used

| Topic | Direction | Purpose |
|---|---|---|
| `<deviceId>/rpc` | backend → device | `Switch.Set` pulse, `Switch.SetConfig` |
| `woodstar-backend/rpc` | device → backend | RPC responses (`src` = `woodstar-backend`) |
| `<deviceId>/online` | device → backend | retained `true`/`false` |

## Testing without hardware

`MQTT_ENABLED=false` (the `dev` profile default outside Docker) swaps in a fake controller that
acknowledges every open after 300 ms. Device ids containing `offline` are reported offline
and fail, so you can test the error path. The Docker stack runs the real broker; with no
Shelly connected the open times out after 5 s and the pickup page shows the retry state.

To simulate a device against the real broker (subscribe to the device's own `<deviceId>/rpc`
topic, never to `+/rpc`: that wildcard also matches the backend's reply topic
`woodstar-backend/rpc`, and a script that answers everything it hears will loop and flood the broker):

```bash
# answer the next RPC call as device shellyplus1-dev0001
docker compose exec mosquitto mosquitto_sub -u backend -P backend -t 'shellyplus1-dev0001/rpc' -C 1
docker compose exec mosquitto mosquitto_pub -u backend -P backend -t 'woodstar-backend/rpc' \
  -m '{"id":1,"src":"shellyplus1-dev0001","dst":"woodstar-backend","result":{"was_on":false}}'
docker compose exec mosquitto mosquitto_pub -u backend -P backend -r -t 'shellyplus1-dev0001/online' -m true
```
