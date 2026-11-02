-- Uruchamiane ręcznie, bez kasowania istniejących danych.
CREATE TABLE IF NOT EXISTS transport_orders (
  id text PRIMARY KEY,
  route text NOT NULL,
  planned_at timestamptz,
  eta timestamptz,
  eta_reliable boolean NOT NULL DEFAULT false
);
INSERT INTO transport_orders (id, route, planned_at, eta, eta_reliable)
VALUES ('TR-001', 'Warszawa → Kraków', '2026-11-02T14:00:00+01:00', '2026-11-02T14:25:00+01:00', true)
ON CONFLICT (id) DO NOTHING;
