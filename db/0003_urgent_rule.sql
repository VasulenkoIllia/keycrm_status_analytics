-- Add urgent_rule reference for orders_current to store matched urgent rule name/identifier

ALTER TABLE orders_current
  ADD COLUMN IF NOT EXISTS urgent_rule TEXT;
