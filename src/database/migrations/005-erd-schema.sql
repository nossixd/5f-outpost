-- ERD schema and one-way, non-destructive copy from the legacy tables.
-- USER and ORDER are reserved SQL words; use "app_user" and "order".
-- Run only after backing up the source database. This migration is not run by the app.
BEGIN;

CREATE TABLE IF NOT EXISTS company (
  company_id serial PRIMARY KEY,
  name varchar(255) NOT NULL,
  tax_number varchar(255),
  address varchar(255)
);

CREATE TABLE IF NOT EXISTS "app_user" (
  user_id serial PRIMARY KEY,
  company_id int NOT NULL REFERENCES company(company_id) ON DELETE RESTRICT,
  email varchar(255) NOT NULL UNIQUE,
  password_hash varchar(255),
  first_name varchar(255),
  last_name varchar(255),
  role varchar(255)
);

CREATE TABLE IF NOT EXISTS client (
  client_id serial PRIMARY KEY,
  company_id int NOT NULL REFERENCES company(company_id) ON DELETE RESTRICT,
  name varchar(255) NOT NULL,
  email varchar(255),
  phone varchar(255),
  address varchar(255)
);

CREATE TABLE IF NOT EXISTS driver (
  driver_id serial PRIMARY KEY,
  company_id int NOT NULL REFERENCES company(company_id) ON DELETE RESTRICT,
  user_id int REFERENCES "app_user"(user_id) ON DELETE SET NULL,
  license_number varchar(255),
  phone varchar(255),
  driver_name varchar(255)
);

CREATE TABLE IF NOT EXISTS vehicle (
  vehicle_id serial PRIMARY KEY,
  company_id int REFERENCES company(company_id) ON DELETE RESTRICT,
  registration_number varchar(255) NOT NULL UNIQUE,
  brand varchar(255),
  model varchar(255),
  active boolean NOT NULL DEFAULT true,
  legacy_vehicle_id text UNIQUE
);

CREATE TABLE IF NOT EXISTS "order" (
  order_id serial PRIMARY KEY,
  company_id int REFERENCES company(company_id) ON DELETE RESTRICT,
  client_id int REFERENCES client(client_id) ON DELETE RESTRICT,
  driver_id int REFERENCES driver(driver_id) ON DELETE RESTRICT,
  vehicle_id int REFERENCES vehicle(vehicle_id) ON DELETE RESTRICT,
  pickup_address varchar(255),
  delivery_address varchar(255),
  route text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  planned_at timestamptz,
  eta timestamptz,
  eta_reliable boolean NOT NULL DEFAULT false,
  status varchar(255) NOT NULL DEFAULT 'in_progress'
    CHECK (status IN ('in_progress', 'completed')),
  decision varchar(255) CHECK (decision IN ('approved', 'rejected')),
  decision_at timestamptz,
  completed_at timestamptz,
  completed_by text,
  legacy_order_id text UNIQUE
);

CREATE TABLE IF NOT EXISTS order_status_history (
  history_id serial PRIMARY KEY,
  order_id int NOT NULL REFERENCES "order"(order_id) ON DELETE CASCADE,
  changed_by int REFERENCES "app_user"(user_id) ON DELETE SET NULL,
  changed_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  old_status varchar(255),
  new_status varchar(255) NOT NULL,
  description text
);

CREATE TABLE IF NOT EXISTS route (
  route_id serial PRIMARY KEY,
  order_id int NOT NULL REFERENCES "order"(order_id) ON DELETE CASCADE,
  planned_distance decimal,
  planned_duration int,
  route_data jsonb CHECK (route_data IS NULL OR jsonb_typeof(route_data) = 'array'),
  legacy_route_id text UNIQUE,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS gps_location (
  location_id bigserial PRIMARY KEY,
  vehicle_id int NOT NULL REFERENCES vehicle(vehicle_id) ON DELETE CASCADE,
  latitude decimal NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude decimal NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  recorded_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  street varchar(255),
  city varchar(255),
  country varchar(255),
  speed_kmh numeric(6,2) CHECK (speed_kmh BETWEEN 0 AND 250),
  legacy_location_id text UNIQUE
);

CREATE TABLE IF NOT EXISTS report (
  report_id serial PRIMARY KEY,
  order_id int NOT NULL REFERENCES "order"(order_id) ON DELETE CASCADE,
  created_by int REFERENCES "app_user"(user_id) ON DELETE SET NULL,
  report_type varchar(255) NOT NULL,
  description text,
  status varchar(255),
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at timestamptz
);

CREATE TABLE IF NOT EXISTS cost (
  cost_id serial PRIMARY KEY,
  order_id int REFERENCES "order"(order_id) ON DELETE CASCADE,
  raw_cost_id bigint,
  cost_type varchar(255),
  amount decimal NOT NULL CHECK (amount >= 0),
  currency varchar(10) NOT NULL DEFAULT 'PLN',
  cost_date date
);

CREATE TABLE IF NOT EXISTS external_system (
  external_system_id serial PRIMARY KEY,
  name varchar(255) NOT NULL,
  system_type varchar(255)
);

CREATE TABLE IF NOT EXISTS raw_cost_data (
  raw_cost_id bigserial PRIMARY KEY,
  vehicle_id int REFERENCES vehicle(vehicle_id) ON DELETE SET NULL,
  external_system_id int REFERENCES external_system(external_system_id) ON DELETE SET NULL,
  cost_type varchar(255),
  raw_data jsonb,
  imported_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'cost_raw_cost_fk' AND conrelid = 'cost'::regclass
  ) THEN
    ALTER TABLE cost ADD CONSTRAINT cost_raw_cost_fk
      FOREIGN KEY (raw_cost_id) REFERENCES raw_cost_data(raw_cost_id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS gps_location_vehicle_recorded_idx
  ON gps_location (vehicle_id, recorded_at DESC, location_id DESC);
CREATE INDEX IF NOT EXISTS gps_location_recorded_idx
  ON gps_location (recorded_at DESC);
CREATE INDEX IF NOT EXISTS order_company_idx ON "order"(company_id);
CREATE INDEX IF NOT EXISTS order_status_idx ON "order"(status);
CREATE INDEX IF NOT EXISTS order_vehicle_idx ON "order"(vehicle_id);
CREATE INDEX IF NOT EXISTS route_order_idx ON route(order_id);
CREATE INDEX IF NOT EXISTS order_status_history_order_idx
  ON order_status_history(order_id, changed_at DESC);

-- A missing legacy company/client/driver is not fabricated. These FKs remain
-- nullable until real corresponding records are available.
INSERT INTO vehicle (registration_number, brand, model, active, legacy_vehicle_id)
SELECT v.registration, split_part(v.model, ' ', 1), v.model, v.active, v.id
FROM vehicles v
ON CONFLICT DO NOTHING;

INSERT INTO "order" (
  route, planned_at, eta, eta_reliable, status, decision, decision_at,
  completed_at, completed_by, legacy_order_id
)
SELECT o.route, o.planned_at, o.eta, o.eta_reliable, o.status,
       o.decision, o.decision_at, o.completed_at, o.completed_by, o.id
FROM transport_orders o
ON CONFLICT DO NOTHING;

UPDATE "order" target
SET vehicle_id = v.vehicle_id
FROM vehicle_routes old_route
JOIN vehicle v ON v.legacy_vehicle_id = old_route.vehicle_id
WHERE target.legacy_order_id = old_route.order_id
  AND target.vehicle_id IS NULL;

INSERT INTO route (order_id, route_data, legacy_route_id, active, created_at)
SELECT target.order_id, old_route.coordinates, old_route.id, old_route.active, old_route.created_at
FROM vehicle_routes old_route
JOIN "order" target ON target.legacy_order_id = old_route.order_id
ON CONFLICT DO NOTHING;

INSERT INTO gps_location (
  vehicle_id, latitude, longitude, recorded_at, street, city, country,
  speed_kmh, legacy_location_id
)
SELECT v.vehicle_id, old_location.latitude, old_location.longitude,
       old_location.updated_at, old_location.street, old_location.city,
       old_location.country, old_location.speed_kmh, old_location.id
FROM vehicle_locations old_location
JOIN vehicle v ON v.legacy_vehicle_id = old_location.vehicle_id
ON CONFLICT DO NOTHING;

COMMIT;
