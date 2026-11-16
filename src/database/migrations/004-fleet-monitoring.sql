-- FR-01: przykładowa flota, trasy i symulowane pozycje GPS.
-- Bez kasowania lub nadpisywania rekordów; można uruchamiać wielokrotnie.
BEGIN;

INSERT INTO transport_orders (id, route, planned_at, eta, eta_reliable)
VALUES
  ('TR-004', 'Wrocław → Opole', '2026-11-02T17:00:00+01:00', NULL, false),
  ('TR-005', 'Berlin → Hamburg', '2026-11-02T18:00:00+01:00', NULL, false)
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS vehicles (
  id text PRIMARY KEY,
  registration text NOT NULL UNIQUE,
  model text NOT NULL,
  active boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS vehicle_routes (
  id text PRIMARY KEY,
  vehicle_id text NOT NULL REFERENCES vehicles(id) ON DELETE RESTRICT,
  order_id text NOT NULL REFERENCES transport_orders(id) ON DELETE RESTRICT,
  name text NOT NULL,
  coordinates jsonb NOT NULL
    CHECK (jsonb_typeof(coordinates) = 'array' AND jsonb_array_length(coordinates) >= 2),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (id, vehicle_id),
  UNIQUE (vehicle_id, order_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS vehicle_routes_one_active_per_vehicle
  ON vehicle_routes (vehicle_id) WHERE active;

CREATE TABLE IF NOT EXISTS vehicle_locations (
  id text PRIMARY KEY,
  vehicle_id text NOT NULL REFERENCES vehicles(id) ON DELETE RESTRICT,
  route_id text NOT NULL,
  street text NOT NULL,
  city text NOT NULL,
  country text NOT NULL,
  latitude double precision NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude double precision NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  speed_kmh numeric(6, 2) NOT NULL CHECK (speed_kmh BETWEEN 0 AND 250),
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (route_id, vehicle_id) REFERENCES vehicle_routes(id, vehicle_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS vehicle_locations_latest_idx
  ON vehicle_locations (vehicle_id, updated_at DESC, id DESC);

INSERT INTO vehicles (id, registration, model)
VALUES
  ('VH-001', 'WX 1234A', 'Volvo FH'),
  ('VH-002', 'EL 2048K', 'Mercedes-Benz Actros'),
  ('VH-003', 'GD 7310P', 'Scania R 450'),
  ('VH-004', 'DW 5521M', 'MAN TGX'),
  ('VH-005', 'B 5F OUT', 'DAF XG')
ON CONFLICT DO NOTHING;

INSERT INTO vehicle_routes (id, vehicle_id, order_id, name, coordinates)
VALUES
  ('VR-001', 'VH-001', 'TR-001', 'Warszawa → Kraków',
   '[{"lat":52.2297,"lng":21.0122},{"lat":51.5,"lng":20.5},{"lat":50.0647,"lng":19.945}]'::jsonb),
  ('VR-002', 'VH-002', 'TR-002', 'Łódź → Poznań',
   '[{"lat":51.7592,"lng":19.455},{"lat":52.1,"lng":18.8},{"lat":52.4064,"lng":16.9252}]'::jsonb),
  ('VR-003', 'VH-003', 'TR-003', 'Gdańsk → Toruń',
   '[{"lat":54.352,"lng":18.6466},{"lat":53.7,"lng":18.8},{"lat":53.0138,"lng":18.5984}]'::jsonb),
  ('VR-004', 'VH-004', 'TR-004', 'Wrocław → Opole',
   '[{"lat":51.1079,"lng":17.0385},{"lat":50.9,"lng":17.1},{"lat":50.6751,"lng":17.9213}]'::jsonb),
  ('VR-005', 'VH-005', 'TR-005', 'Berlin → Hamburg',
   '[{"lat":52.52,"lng":13.405},{"lat":53.1,"lng":13.5},{"lat":53.5511,"lng":9.9937}]'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO vehicle_locations
  (id, vehicle_id, route_id, street, city, country, latitude, longitude, speed_kmh, updated_at)
SELECT sample.*
FROM (VALUES
  ('LOC-001', 'VH-001', 'VR-001', 'Aleje Jerozolimskie', 'Warszawa', 'Polska', 52.2297, 21.0122, 68.5, CURRENT_TIMESTAMP - INTERVAL '5 seconds'),
  ('LOC-002', 'VH-002', 'VR-002', 'Aleja Włókniarzy', 'Łódź', 'Polska', 51.7592, 19.4550, 74.0, CURRENT_TIMESTAMP - INTERVAL '15 seconds'),
  ('LOC-003', 'VH-003', 'VR-003', 'Trakt św. Wojciecha', 'Gdańsk', 'Polska', 54.3520, 18.6466, 0.0, CURRENT_TIMESTAMP - INTERVAL '28 seconds'),
  ('LOC-004', 'VH-004', 'VR-004', 'ul. Karkonoska', 'Wrocław', 'Polska', 51.1079, 17.0385, 82.3, CURRENT_TIMESTAMP - INTERVAL '35 seconds'),
  ('LOC-005', 'VH-005', 'VR-005', 'Frankfurter Allee', 'Berlin', 'Niemcy', 52.5200, 13.4050, 96.0, CURRENT_TIMESTAMP - INTERVAL '65 seconds')
) AS sample(id, vehicle_id, route_id, street, city, country, latitude, longitude, speed_kmh, updated_at)
ON CONFLICT DO NOTHING;

COMMIT;
