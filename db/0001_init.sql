-- Schema initialization for KeyCRM Status Analytics (multi-CRM)

CREATE TABLE IF NOT EXISTS projects (
    id              SERIAL PRIMARY KEY,
    name            TEXT NOT NULL,
    base_url        TEXT,
    api_token       TEXT,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS project_settings (
    project_id          INTEGER PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
    default_sla_profile TEXT DEFAULT 'default',
    timezone            TEXT DEFAULT 'UTC',
    default_cycle_id    INTEGER,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS status_group_dict (
    project_id  INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    group_id    INTEGER NOT NULL,
    group_name  TEXT NOT NULL,
    PRIMARY KEY (project_id, group_id)
);

CREATE TABLE IF NOT EXISTS status_dict (
    project_id        INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    status_id         INTEGER NOT NULL,
    name              TEXT NOT NULL,
    alias             TEXT,
    group_id          INTEGER NOT NULL,
    is_active         BOOLEAN DEFAULT TRUE,
    is_closing_order  BOOLEAN DEFAULT FALSE,
    expiration_period INTEGER,
    PRIMARY KEY (project_id, status_id),
    FOREIGN KEY (project_id, group_id) REFERENCES status_group_dict(project_id, group_id)
);

CREATE TABLE IF NOT EXISTS sla_stage_rules (
    project_id  INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    group_id    INTEGER NOT NULL,
    is_urgent   BOOLEAN DEFAULT FALSE,
    limit_hours NUMERIC NOT NULL,
    PRIMARY KEY (project_id, group_id, is_urgent),
    FOREIGN KEY (project_id, group_id) REFERENCES status_group_dict(project_id, group_id)
);

CREATE TABLE IF NOT EXISTS cycle_rules (
    id              SERIAL PRIMARY KEY,
    project_id      INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    title           TEXT DEFAULT 'default',
    start_group_id  INTEGER,
    start_status_id INTEGER,
    end_group_id    INTEGER,
    end_status_id   INTEGER,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    CHECK (start_group_id IS NOT NULL OR start_status_id IS NOT NULL),
    CHECK (end_group_id IS NOT NULL OR end_status_id IS NOT NULL)
);

ALTER TABLE project_settings
  ADD CONSTRAINT project_settings_default_cycle_fk
  FOREIGN KEY (default_cycle_id) REFERENCES cycle_rules(id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE IF NOT EXISTS urgent_rules (
    id          SERIAL PRIMARY KEY,
    project_id  INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    rule_name   TEXT NOT NULL,
    match_type  TEXT NOT NULL CHECK (match_type IN ('sku', 'offer_id', 'product_id')),
    match_value TEXT NOT NULL,
    is_active   BOOLEAN DEFAULT TRUE,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_overrides (
    project_id              INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    order_id                BIGINT NOT NULL,
    is_urgent_override      BOOLEAN,
    sla_profile_override    TEXT,
    cycle_start_override    INTEGER,
    cycle_end_override      INTEGER,
    PRIMARY KEY (project_id, order_id)
);

CREATE TABLE IF NOT EXISTS order_status_events (
    id                BIGSERIAL PRIMARY KEY,
    project_id        INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    order_id          BIGINT NOT NULL,
    status_id         INTEGER NOT NULL,
    status_group_id   INTEGER NOT NULL,
    status_changed_at TIMESTAMPTZ NOT NULL,
    order_created_at  TIMESTAMPTZ,
    payload           JSONB,
    dedup_key         TEXT,
    inserted_at       TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (dedup_key),
    UNIQUE (project_id, order_id, status_changed_at, status_id),
    FOREIGN KEY (project_id, status_id) REFERENCES status_dict(project_id, status_id),
    FOREIGN KEY (project_id, status_group_id) REFERENCES status_group_dict(project_id, group_id)
);

CREATE INDEX IF NOT EXISTS idx_events_order_time ON order_status_events(project_id, order_id, status_changed_at);

CREATE TABLE IF NOT EXISTS orders_current (
    project_id             INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    order_id               BIGINT NOT NULL,
    started_at             TIMESTAMPTZ,
    last_status_id         INTEGER,
    last_status_group_id   INTEGER,
    last_changed_at        TIMESTAMPTZ,
    is_urgent              BOOLEAN DEFAULT FALSE,
    delivery_entered_at    TIMESTAMPTZ,
    cycle_duration_to_delivery INTERVAL,
    closed_at              TIMESTAMPTZ,
    cycle_rule_id_applied  INTEGER,
    updated_at             TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (project_id, order_id),
    FOREIGN KEY (project_id, last_status_id) REFERENCES status_dict(project_id, status_id),
    FOREIGN KEY (project_id, last_status_group_id) REFERENCES status_group_dict(project_id, group_id),
    FOREIGN KEY (cycle_rule_id_applied) REFERENCES cycle_rules(id)
);

CREATE TABLE IF NOT EXISTS order_cycle_metrics (
    project_id     INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    order_id       BIGINT NOT NULL,
    cycle_rule_id  INTEGER REFERENCES cycle_rules(id) ON DELETE CASCADE,
    duration_seconds INTEGER,
    updated_at     TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (project_id, order_id, cycle_rule_id)
);

CREATE TABLE IF NOT EXISTS order_items (
    id              BIGSERIAL PRIMARY KEY,
    project_id      INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    order_id        BIGINT NOT NULL,
    offer_id        INTEGER,
    product_id      INTEGER,
    sku             TEXT,
    name            TEXT,
    qty             NUMERIC,
    price_sold      NUMERIC,
    purchased_price NUMERIC,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_items_order ON order_items(project_id, order_id);

CREATE TABLE IF NOT EXISTS order_marketing (
    project_id      INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    order_id        BIGINT NOT NULL,
    utm_source      TEXT,
    utm_medium      TEXT,
    utm_campaign    TEXT,
    utm_term        TEXT,
    utm_content     TEXT,
    fbclid          TEXT,
    _fbc            TEXT,
    _fbp            TEXT,
    raw_comment     TEXT,
    PRIMARY KEY (project_id, order_id)
);

-- helpful view for intervals (logic placeholder; to be refined in code)
-- Example:
-- CREATE VIEW order_status_intervals AS
-- SELECT project_id, order_id, status_id, status_group_id,
--        status_changed_at AS entered_at,
--        LEAD(status_changed_at) OVER (PARTITION BY project_id, order_id ORDER BY status_changed_at) AS left_at
-- FROM order_status_events;
