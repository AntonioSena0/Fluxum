-- Criação de tabelas base (só se ainda não existirem)
CREATE TABLE IF NOT EXISTS ships (
  ship_id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  imo TEXT UNIQUE,
  flag TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS voyages (
  voyage_id SERIAL PRIMARY KEY,
  ship_id INTEGER NOT NULL REFERENCES ships(ship_id),
  voyage_code TEXT UNIQUE,
  departure_port TEXT,
  arrival_port TEXT,
  departure_date TIMESTAMPTZ,
  arrival_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS voyage_containers (
  voyage_id INTEGER NOT NULL REFERENCES voyages(voyage_id),
  container_id TEXT NOT NULL,
  loaded_at TIMESTAMPTZ,
  unloaded_at TIMESTAMPTZ,
  PRIMARY KEY (voyage_id, container_id)
);

CREATE TABLE IF NOT EXISTS container_movements (
  id SERIAL PRIMARY KEY,
  container_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  site TEXT,
  location TEXT,
  gpio INTEGER,
  device_id TEXT,
  tag TEXT,
  ts_iso TIMESTAMPTZ,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  geohash TEXT,
  meta JSONB,
  idempotency_key TEXT,
  source TEXT,
  voyage_id INTEGER REFERENCES voyages(voyage_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS container_state (
  container_id TEXT PRIMARY KEY,
  last_event_type TEXT NOT NULL,
  last_location TEXT,
  last_site TEXT,
  last_gpio INTEGER,
  last_ts_iso TIMESTAMPTZ,
  last_lat DOUBLE PRECISION,
  last_lng DOUBLE PRECISION,
  last_tag TEXT,
  last_device_id TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Dados iniciais
INSERT INTO ships (name, imo, flag)
VALUES ('MSC Seaview','IMO 9745378','Panama')
ON CONFLICT (imo) DO NOTHING;

INSERT INTO voyages (ship_id, voyage_code, departure_port, arrival_port, departure_date, arrival_date)
SELECT ship_id, 'VOY-2025-09A', 'Porto de Santos (BRSSZ)', 'Port of Rotterdam (NLRTM)',
       '2025-09-03T10:00:00Z','2025-09-18T08:00:00Z'
FROM ships
WHERE imo='IMO 9745378'
ON CONFLICT (voyage_code) DO NOTHING;

INSERT INTO voyage_containers (voyage_id, container_id, loaded_at)
SELECT voyage_id, 'CONT-123', NOW()
FROM voyages
WHERE voyage_code='VOY-2025-09A'
ON CONFLICT DO NOTHING;

INSERT INTO voyage_containers (voyage_id, container_id, loaded_at)
SELECT voyage_id, 'CONT-456', NOW()
FROM voyages
WHERE voyage_code='VOY-2025-09A'
ON CONFLICT DO NOTHING;

-- Checar o ID da viagem
SELECT voyage_id, voyage_code FROM voyages WHERE voyage_code='VOY-2025-09A';
