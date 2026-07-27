-- Hardware orders including not_needed. Costs in cents. Partial does not count as received.

CREATE TABLE hardware_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'not_started',
  supplier text NOT NULL DEFAULT 'CRL',
  order_number text,
  fulfillment text,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  cost integer,
  partial boolean NOT NULL DEFAULT false,
  missing_note text,
  received_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX hardware_orders_project_idx ON hardware_orders (company_id, project_id);

ALTER TABLE hardware_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE hardware_orders FORCE ROW LEVEL SECURITY;

CREATE POLICY hardware_orders_isolation ON hardware_orders FOR ALL
  USING (company_id::text = current_setting('app.company_id', true))
  WITH CHECK (company_id::text = current_setting('app.company_id', true));
