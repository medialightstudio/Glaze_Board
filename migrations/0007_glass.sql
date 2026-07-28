-- Glass orders including not_needed and remake parent links. Prices in cents.

CREATE TABLE glass_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'not_ordered',
  supplier text NOT NULL DEFAULT 'Glassfab',
  po_number text NOT NULL,
  supplier_order_number text,
  line_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  price integer,
  promised_date date,
  received_at timestamptz,
  parent_order_id uuid REFERENCES glass_orders(id),
  remake_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, po_number)
);

CREATE TABLE po_sequences (
  company_id uuid PRIMARY KEY REFERENCES companies(id),
  year integer NOT NULL,
  last_n integer NOT NULL DEFAULT 0
);

CREATE INDEX glass_orders_project_idx ON glass_orders (company_id, project_id);

ALTER TABLE glass_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE glass_orders FORCE ROW LEVEL SECURITY;
ALTER TABLE po_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE po_sequences FORCE ROW LEVEL SECURITY;

CREATE POLICY glass_orders_isolation ON glass_orders FOR ALL
  USING (company_id::text = current_setting('app.company_id', true))
  WITH CHECK (company_id::text = current_setting('app.company_id', true));
CREATE POLICY po_sequences_isolation ON po_sequences FOR ALL
  USING (company_id::text = current_setting('app.company_id', true))
  WITH CHECK (company_id::text = current_setting('app.company_id', true));
