CREATE TABLE site (
    id          UUID PRIMARY KEY,
    name        TEXT NOT NULL,
    address     TEXT NOT NULL,
    lat         DOUBLE PRECISION,
    lng         DOUBLE PRECISION,
    active      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL
);

CREATE TABLE product (
    id              UUID PRIMARY KEY,
    name_et         TEXT NOT NULL,
    name_en         TEXT NOT NULL,
    description_et  TEXT,
    description_en  TEXT,
    price_cents     INTEGER NOT NULL CHECK (price_cents >= 0),
    active          BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order      INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL
);

CREATE TABLE locker (
    id                UUID PRIMARY KEY,
    site_id           UUID NOT NULL REFERENCES site(id),
    label             TEXT NOT NULL,
    shelly_device_id  TEXT NOT NULL,
    relay_channel     INTEGER NOT NULL DEFAULT 0,
    pulse_seconds     INTEGER NOT NULL DEFAULT 2,
    state             TEXT NOT NULL,
    product_id        UUID REFERENCES product(id),
    stocked_at        TIMESTAMPTZ,
    note              TEXT,
    updated_at        TIMESTAMPTZ NOT NULL,
    CONSTRAINT uq_locker_site_label UNIQUE (site_id, label)
);
CREATE INDEX idx_locker_site_state ON locker(site_id, state);
CREATE INDEX idx_locker_device ON locker(shelly_device_id);

CREATE SEQUENCE order_number_seq START 1;

CREATE TABLE orders (
    id                UUID PRIMARY KEY,
    order_number      TEXT NOT NULL UNIQUE,
    site_id           UUID NOT NULL REFERENCES site(id),
    locker_id         UUID NOT NULL REFERENCES locker(id),
    product_id        UUID NOT NULL REFERENCES product(id),
    product_name      TEXT NOT NULL,
    price_cents       INTEGER NOT NULL,
    email             TEXT NOT NULL,
    phone             TEXT,
    locale            TEXT NOT NULL DEFAULT 'et',
    state             TEXT NOT NULL,
    pickup_token      TEXT NOT NULL UNIQUE,
    payment_provider  TEXT NOT NULL,
    payment_ref       TEXT,
    created_at        TIMESTAMPTZ NOT NULL,
    paid_at           TIMESTAMPTZ,
    pickup_deadline   TIMESTAMPTZ,
    picked_up_at      TIMESTAMPTZ,
    first_open_at     TIMESTAMPTZ,
    open_count        INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_orders_state_created ON orders(state, created_at);
CREATE INDEX idx_orders_locker ON orders(locker_id);
CREATE INDEX idx_orders_payment_ref ON orders(payment_ref);

CREATE TABLE locker_event (
    id          UUID PRIMARY KEY,
    locker_id   UUID NOT NULL REFERENCES locker(id),
    order_id    UUID REFERENCES orders(id),
    type        TEXT NOT NULL,
    detail      TEXT,
    created_at  TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_locker_event_locker_created ON locker_event(locker_id, created_at DESC);

CREATE TABLE admin_user (
    id             UUID PRIMARY KEY,
    username       TEXT NOT NULL UNIQUE,
    password_hash  TEXT NOT NULL,
    created_at     TIMESTAMPTZ NOT NULL
);
