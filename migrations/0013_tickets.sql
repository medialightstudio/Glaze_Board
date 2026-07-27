-- Service tickets + public form slug on companies.

CREATE TABLE tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  status text NOT NULL DEFAULT 'new',
  contact_name text,
  contact_phone text,
  contact_email text,
  address text,
  address_norm text,
  address_unit text,
  zip text,
  issue text NOT NULL,
  urgency text NOT NULL DEFAULT 'normal',
  source text NOT NULL DEFAULT 'manual',
  classification text,
  classification_confirmed boolean NOT NULL DEFAULT false,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  no_match boolean NOT NULL DEFAULT false,
  transcript_url text,
  recording_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX tickets_status_idx ON tickets (company_id, status);
CREATE INDEX tickets_address_norm_idx ON tickets (company_id, address_norm);
CREATE INDEX tickets_phone_idx ON tickets (company_id, contact_phone);

ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets FORCE ROW LEVEL SECURITY;

-- Office users: full access within company.
CREATE POLICY tickets_office ON tickets FOR ALL
  USING (
    company_id::text = current_setting('app.company_id', true)
    AND current_setting('app.role', true) IN ('admin', 'manager', 'field')
  )
  WITH CHECK (company_id::text = current_setting('app.company_id', true));

-- Public form inserts via systemContext (role=system): insert only.
CREATE POLICY tickets_system_insert ON tickets FOR INSERT
  WITH CHECK (
    company_id::text = current_setting('app.company_id', true)
    AND current_setting('app.role', true) = 'system'
  );

ALTER TABLE activity_events
  DROP CONSTRAINT IF EXISTS activity_events_ticket_id_fkey;
ALTER TABLE activity_events
  ADD CONSTRAINT activity_events_ticket_id_fkey
  FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE;

ALTER TABLE visits
  DROP CONSTRAINT IF EXISTS visits_ticket_id_fkey;
ALTER TABLE visits
  ADD CONSTRAINT visits_ticket_id_fkey
  FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE;

ALTER TABLE documents
  DROP CONSTRAINT IF EXISTS documents_ticket_id_fkey;
ALTER TABLE documents
  ADD CONSTRAINT documents_ticket_id_fkey
  FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE;
