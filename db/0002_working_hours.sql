-- Working hours per project and status group
-- Weekday: 0 = Monday ... 6 = Sunday

CREATE TABLE IF NOT EXISTS working_hours (
    project_id  INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    group_id    INTEGER NOT NULL,
    weekday     SMALLINT NOT NULL CHECK (weekday BETWEEN 0 AND 6),
    ranges      JSONB NOT NULL, -- [{ "start": "09:00", "end": "18:00" }, ...]
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (project_id, group_id, weekday),
    FOREIGN KEY (project_id, group_id) REFERENCES status_group_dict(project_id, group_id)
);

CREATE INDEX IF NOT EXISTS idx_working_hours_proj_group ON working_hours(project_id, group_id);

-- Webhook settings per project
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS webhook_url TEXT,
  ADD COLUMN IF NOT EXISTS webhook_token TEXT;
