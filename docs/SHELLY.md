# Shelly setup for a locker

Each locker door is an electric strike or solenoid lock wired to one relay output of a
Shelly Gen2+ device (Shelly Plus 1, Plus 1PM, Pro 1, Pro 2, Pro 4PM ...). A Pro 4PM
drives four doors from one device: channels 0–3. The backend pulses the relay for
`pulse_seconds` (default 2 s) using `Switch.Set` with `toggle_after`, so a door can
never be left powered open by a dropped connection.

## 1. Create the device's login in admin

Admin → *Devices* → **Add device** and enter the device id (Shelly web UI → *Settings → Device info*,
e.g. `shellyplus1-a8032abcdef0`). The app creates a broker login for it with a random password and shows:

| Setting | Value |
|---|---|
| Server | `puukapp.ee:1883` (`MQTT_PUBLIC_HOST`/`MQTT_PUBLIC_PORT`, default: the host of `PUBLIC_BASE_URL`) |
| Username | the device id |
| Password | 32 random characters, **shown only this once** |

Lost it? Press **New password** on the device's row; the old one stops working at once. **Remove login**
locks a device out. A device that a locker points at but that has no login yet shows *No broker login*
with a **Create login** button.

The broker (Mosquitto Dynamic Security, `infra/mosquitto/`) stores only password hashes, in
`/mosquitto/data/dynamic-security.json` on the `mosquitto_data` volume. Each device may publish only below
its own id and to `woodstar-backend/rpc`, so one leaked password cannot open another device's doors.
The backend is the plugin's admin; `entrypoint.sh` creates it from `MQTT_USERNAME`/`MQTT_PASSWORD` on first
start and re-applies the password on every start.

## 2. Shelly MQTT settings

**From your phone (quickest):** connect to the Shelly's own Wi-Fi (`192.168.33.1`) or the network it is on,
then in the dialog tap *Send settings to the Shelly* and *Reboot the Shelly*. These are plain links to the
device's local HTTP RPC (`MQTT.SetConfig`, `Shelly.Reboot`); if the device has a web password, the browser asks for it.

**By hand:** Shelly web UI (or app) → *Settings → MQTT*:

| Setting | Value |
|---|---|
| Enable MQTT | on |
| Server / Username / Password | from the dialog |
| Client ID / MQTT prefix | leave as the device id (default) |
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

To simulate a device against the real broker, create its login in admin → Devices first and use that
password (`PW` below). Subscribe to the device's own `<deviceId>/rpc` topic, never to `+/rpc`: that wildcard also
matches the backend's reply topic `woodstar-backend/rpc`, and a script that answers everything it hears will loop
and flood the broker.

```bash
# answer the next RPC call as device shellyplus1-dev0001
D=shellyplus1-dev0001
docker compose exec mosquitto mosquitto_pub -u $D -P "$PW" -r -t "$D/online" -m true
docker compose exec mosquitto mosquitto_sub -u $D -P "$PW" -t "$D/rpc" -C 1
docker compose exec mosquitto mosquitto_pub -u $D -P "$PW" -t 'woodstar-backend/rpc' \
  -m '{"id":1,"src":"shellyplus1-dev0001","dst":"woodstar-backend","result":{"was_on":false}}'
```
