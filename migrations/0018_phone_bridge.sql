-- Phone + CRL Bridge jobs + company feature flags.

CREATE TABLE bridge_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  level integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'queued',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  screenshot_keys jsonb NOT NULL DEFAULT '[]'::jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE call_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  ticket_id uuid REFERENCES tickets(id) ON DELETE SET NULL,
  from_phone text,
  recording_url text,
  transcript text,
  analysis jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS crl_bridge_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS crl_tos_accepted boolean NOT NULL DEFAULT false;

ALTER TABLE bridge_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE bridge_jobs FORCE ROW LEVEL SECURITY;
CREATE POLICY bridge_jobs_isolation ON bridge_jobs FOR ALL
  USING (company_id::text = current_setting('app.company_id', true))
  WITH CHECK (company_id::text = current_setting('app.company_id', true));

ALTER TABLE call_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_logs FORCE ROW LEVEL SECURITY;
CREATE POLICY call_logs_isolation ON call_logs FOR ALL
  USING (company_id::text = current_setting('app.company_id', true))
  WITH CHECK (company_id::text = current_setting('app.company_id', true));
