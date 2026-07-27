-- Documents metadata — bytes live in R2; app is the only gate.

CREATE TABLE documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  file text NOT NULL,
  type text NOT NULL DEFAULT 'other',
  mime text,
  size integer,
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  ticket_id uuid,
  glass_order_id uuid REFERENCES glass_orders(id) ON DELETE SET NULL,
  hardware_order_id uuid REFERENCES hardware_orders(id) ON DELETE SET NULL,
  extracted jsonb,
  source text NOT NULL DEFAULT 'upload',
  email_message_id text,
  signer_name text,
  signed_at timestamptz,
  skip_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX documents_project_idx ON documents (company_id, project_id);

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents FORCE ROW LEVEL SECURITY;

CREATE POLICY documents_isolation ON documents FOR ALL
  USING (company_id::text = current_setting('app.company_id', true))
  WITH CHECK (company_id::text = current_setting('app.company_id', true));
