BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS ships (
  ship_id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  imo TEXT UNIQUE,
  flag TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS voyages (
  voyage_id SERIAL PRIMARY KEY,
  ship_id INTEGER NOT NULL REFERENCES ships(ship_id),
  voyage_code TEXT,
  departure_port TEXT,
  arrival_port TEXT,
  departure_date TIMESTAMPTZ,
  arrival_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS voyage_containers (
  voyage_id INTEGER NOT NULL REFERENCES voyages(voyage_id),
  container_id TEXT NOT NULL,
  loaded_at TIMESTAMPTZ,
  unloaded_at TIMESTAMPTZ,
  PRIMARY KEY (voyage_id, container_id)
);

ALTER TABLE container_movements
  ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS geohash TEXT,
  ADD COLUMN IF NOT EXISTS meta JSONB,
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS source TEXT,
  ADD COLUMN IF NOT EXISTS voyage_id INTEGER REFERENCES voyages(voyage_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_mov_event_type_known'
  ) THEN
    ALTER TABLE container_movements
      ADD CONSTRAINT chk_mov_event_type_known
      CHECK (event_type IN ('RFID_DETECTED','OPEN','CLOSE','MOVE','ENTER','EXIT','ALERT','HEARTBEAT'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_mov_gpio_range'
  ) THEN
    ALTER TABLE container_movements
      ADD CONSTRAINT chk_mov_gpio_range
      CHECK (gpio IS NULL OR gpio BETWEEN 0 AND 39);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_mov_site      ON container_movements(site);
CREATE INDEX IF NOT EXISTS idx_mov_event     ON container_movements(event_type);
CREATE INDEX IF NOT EXISTS idx_mov_geohash   ON container_movements(geohash);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'ux_mov_idempotent'
  ) THEN
    CREATE UNIQUE INDEX ux_mov_idempotent
    ON container_movements (
      container_id,
      event_type,
      COALESCE(ts_iso, created_at),
      COALESCE(device_id,''),
      COALESCE(tag,''),
      COALESCE(idempotency_key,'')
    );
  END IF;
END $$;

ALTER TABLE container_state
  ADD COLUMN IF NOT EXISTS last_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS last_lng DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS last_tag TEXT,
  ADD COLUMN IF NOT EXISTS last_device_id TEXT;

CREATE OR REPLACE FUNCTION fn_upsert_container_state()
RETURNS trigger AS $$
BEGIN
  INSERT INTO container_state (
    container_id, last_event_type, last_location, last_site, last_gpio, last_ts_iso,
    last_lat, last_lng, last_tag, last_device_id, updated_at
  ) VALUES (
    NEW.container_id, NEW.event_type, NEW.location, NEW.site, NEW.gpio,
    COALESCE(NEW.ts_iso, NEW.created_at),
    NEW.lat, NEW.lng, NEW.tag, NEW.device_id, now()
  )
  ON CONFLICT (container_id) DO UPDATE SET
    last_event_type = EXCLUDED.last_event_type,
    last_location   = EXCLUDED.last_location,
    last_site       = EXCLUDED.last_site,
    last_gpio       = EXCLUDED.last_gpio,
    last_ts_iso     = EXCLUDED.last_ts_iso,
    last_lat        = EXCLUDED.last_lat,
    last_lng        = EXCLUDED.last_lng,
    last_tag        = EXCLUDED.last_tag,
    last_device_id  = EXCLUDED.last_device_id,
    updated_at      = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_movements_upsert_state ON container_movements;
CREATE TRIGGER trg_movements_upsert_state
AFTER INSERT ON container_movements
FOR EACH ROW EXECUTE FUNCTION fn_upsert_container_state();

COMMIT;
