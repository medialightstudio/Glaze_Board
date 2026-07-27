-- Activity feed + approvals.

CREATE TABLE activity_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  ticket_id uuid,
  actor text NOT NULL,
  actor_user_id text,
  verb text NOT NULL,
  target text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  undone_by_event_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'combined',
  approved_by_contact_id uuid REFERENCES contacts(id),
  method text,
  note text,
  attachment_document_id uuid,
  at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX activity_events_project_idx ON activity_events (company_id, project_id, created_at DESC);
CREATE INDEX approvals_project_idx ON approvals (company_id, project_id);

ALTER TABLE activity_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_events FORCE ROW LEVEL SECURITY;
ALTER TABLE approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE approvals FORCE ROW LEVEL SECURITY;

CREATE POLICY activity_events_isolation ON activity_events FOR ALL
  USING (company_id::text = current_setting('app.company_id', true))
  WITH CHECK (company_id::text = current_setting('app.company_id', true));
CREATE POLICY approvals_isolation ON approvals FOR ALL
  USING (company_id::text = current_setting('app.company_id', true))
  WITH CHECK (company_id::text = current_setting('app.company_id', true));
