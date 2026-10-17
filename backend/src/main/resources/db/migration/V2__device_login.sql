-- One row per Shelly that has a broker login. The password itself lives only in the broker
-- (hashed, Mosquitto Dynamic Security); it is shown to the admin once when issued.
CREATE TABLE device_login (
    device_id   TEXT PRIMARY KEY,
    issued_at   TIMESTAMPTZ NOT NULL,
    issued_by   TEXT NOT NULL
);
