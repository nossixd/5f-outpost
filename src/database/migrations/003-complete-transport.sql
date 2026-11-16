-- FR-01: idempotentna migracja zachowująca istniejące zlecenia.
BEGIN;

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

COMMIT;
