ALTER TABLE project_settings
  ADD COLUMN IF NOT EXISTS sla_near_threshold NUMERIC DEFAULT 0.8;

COMMENT ON COLUMN project_settings.sla_near_threshold IS 'Поріг наближення до SLA (0..1), за замовчуванням 0.8';
