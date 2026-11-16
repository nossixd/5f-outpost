-- Uruchamiane ręcznie, bez kasowania istniejących danych.
CREATE TABLE IF NOT EXISTS transport_orders (
  id text PRIMARY KEY,
  route text NOT NULL,
  planned_at timestamptz,
  eta timestamptz,
  eta_reliable boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'in_progress',
  completed_at timestamptz,
  completed_by text
);
INSERT INTO transport_orders (id, route, planned_at, eta, eta_reliable)
VALUES ('TR-001', 'Warszawa → Kraków', '2026-11-02T14:00:00+01:00', '2026-11-02T14:25:00+01:00', true)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE transport_orders ADD COLUMN IF NOT EXISTS decision text
  CHECK (decision IN ('approved', 'rejected'));
ALTER TABLE transport_orders ADD COLUMN IF NOT EXISTS decision_at timestamptz;
INSERT INTO transport_orders (id, route, planned_at, eta, eta_reliable)
VALUES
  ('TR-002', 'Łódź → Poznań', '2026-11-02T15:00:00+01:00', '2026-11-02T15:40:00+01:00', true),
  ('TR-003', 'Gdańsk → Toruń', '2026-11-02T16:00:00+01:00', '2026-11-02T16:15:00+01:00', true)
ON CONFLICT (id) DO NOTHING;

-- Idempotentna aktualizacja tabeli już istniejącej; rekordy zastane pozostają aktywne.
ALTER TABLE transport_orders ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'in_progress';
ALTER TABLE transport_orders ADD COLUMN IF NOT EXISTS completed_at timestamptz;
ALTER TABLE transport_orders ADD COLUMN IF NOT EXISTS completed_by text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'transport_orders_status_check'
                   AND conrelid = 'transport_orders'::regclass) THEN
    ALTER TABLE transport_orders ADD CONSTRAINT transport_orders_status_check
      CHECK (status IN ('in_progress', 'completed'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'transport_orders_completion_check'
                   AND conrelid = 'transport_orders'::regclass) THEN
    ALTER TABLE transport_orders ADD CONSTRAINT transport_orders_completion_check
      CHECK ((status = 'in_progress' AND completed_at IS NULL AND completed_by IS NULL)
          OR (status = 'completed' AND completed_at IS NOT NULL));
  END IF;
END $$;
