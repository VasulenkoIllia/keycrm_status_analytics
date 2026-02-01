-- Add order_created_at to orders_current to persist creation timestamp separately

ALTER TABLE orders_current
  ADD COLUMN IF NOT EXISTS order_created_at TIMESTAMPTZ;
