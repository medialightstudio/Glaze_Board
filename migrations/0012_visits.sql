-- Visits are the only record of who is on a job (DEC-29).

CREATE TABLE visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  type text NOT NULL,
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  ticket_id uuid,
  starts_at timestamptz NOT NULL,
  duration interval NOT NULL DEFAULT '2 hours',
  assignees text[] NOT NULL DEFAULT '{}',
  team_id uuid REFERENCES teams(id),
  outcome_note text,
  photos jsonb NOT NULL DEFAULT '[]'::jsonb,
  calendar_uid text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX visits_starts_idx ON visits (company_id, starts_at);
CREATE INDEX visits_project_idx ON visits (company_id, project_id);

ALTER TABLE visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE visits FORCE ROW LEVEL SECURITY;

CREATE POLICY visits_isolation ON visits FOR ALL
  USING (company_id::text = current_setting('app.company_id', true))
  WITH CHECK (company_id::text = current_setting('app.company_id', true));
