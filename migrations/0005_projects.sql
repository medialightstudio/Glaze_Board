-- Projects + project_contacts.

CREATE TABLE projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  title text NOT NULL,
  account_id uuid NOT NULL REFERENCES accounts(id),
  site_address text NOT NULL,
  address_norm text,
  address_unit text,
  zip text,
  lat double precision,
  lng double precision,
  status text NOT NULL DEFAULT 'lead',
  job_type text,
  source text,
  access_lockbox_code text,
  access_notes text,
  hold_reason text,
  hold_until timestamptz,
  lost_reason text,
  gate_fired_at timestamptz,
  note text,
  status_timestamps jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE project_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'other',
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX projects_company_status_idx ON projects (company_id, status);
CREATE INDEX projects_address_norm_idx ON projects (company_id, address_norm);
CREATE INDEX projects_account_id_idx ON projects (company_id, account_id);
CREATE INDEX project_contacts_project_idx ON project_contacts (company_id, project_id);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects FORCE ROW LEVEL SECURITY;
ALTER TABLE project_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_contacts FORCE ROW LEVEL SECURITY;

CREATE POLICY projects_isolation ON projects FOR ALL
  USING (company_id::text = current_setting('app.company_id', true))
  WITH CHECK (company_id::text = current_setting('app.company_id', true));
CREATE POLICY project_contacts_isolation ON project_contacts FOR ALL
  USING (company_id::text = current_setting('app.company_id', true))
  WITH CHECK (company_id::text = current_setting('app.company_id', true));
