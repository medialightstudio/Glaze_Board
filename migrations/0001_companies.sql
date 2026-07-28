-- DEC-3 tenancy · DEC-21 ENABLE + FORCE RLS (owner would otherwise bypass policies)

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  branding jsonb NOT NULL DEFAULT '{}'::jsonb,
  timezone text NOT NULL DEFAULT 'America/Los_Angeles',
  public_form_slug text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies FORCE ROW LEVEL SECURITY;

CREATE POLICY companies_isolation ON companies
  FOR ALL
  USING (id::text = current_setting('app.company_id', true))
  WITH CHECK (id::text = current_setting('app.company_id', true));
