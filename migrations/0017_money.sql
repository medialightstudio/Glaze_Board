-- Money: QuickBooks tokens, invoices, deposits, change orders, SMS threads.

CREATE TABLE qb_connections (
  company_id uuid PRIMARY KEY REFERENCES companies(id),
  realm_id text,
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  product text NOT NULL DEFAULT 'online',
  connected_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  account_id uuid NOT NULL REFERENCES accounts(id),
  qb_invoice_id text,
  kind text NOT NULL DEFAULT 'final',
  status text NOT NULL DEFAULT 'draft',
  total_cents integer NOT NULL DEFAULT 0,
  balance_cents integer NOT NULL DEFAULT 0,
  payment_link text,
  sent_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE invoice_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  description text NOT NULL,
  amount_cents integer NOT NULL DEFAULT 0
);

CREATE TABLE deposits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  invoice_id uuid REFERENCES invoices(id) ON DELETE SET NULL,
  percent numeric,
  amount_cents integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE change_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  description text NOT NULL,
  amount_cents integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE qb_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  kind text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  ok boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sms_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  ticket_id uuid REFERENCES tickets(id) ON DELETE SET NULL,
  phone text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sms_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  thread_id uuid NOT NULL REFERENCES sms_threads(id) ON DELETE CASCADE,
  direction text NOT NULL,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  twilio_sid text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE qb_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE qb_connections FORCE ROW LEVEL SECURITY;
CREATE POLICY qb_connections_isolation ON qb_connections FOR ALL
  USING (company_id::text = current_setting('app.company_id', true))
  WITH CHECK (company_id::text = current_setting('app.company_id', true));

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices FORCE ROW LEVEL SECURITY;
CREATE POLICY invoices_isolation ON invoices FOR ALL
  USING (company_id::text = current_setting('app.company_id', true))
  WITH CHECK (company_id::text = current_setting('app.company_id', true));

ALTER TABLE invoice_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_lines FORCE ROW LEVEL SECURITY;
CREATE POLICY invoice_lines_isolation ON invoice_lines FOR ALL
  USING (company_id::text = current_setting('app.company_id', true))
  WITH CHECK (company_id::text = current_setting('app.company_id', true));

ALTER TABLE deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE deposits FORCE ROW LEVEL SECURITY;
CREATE POLICY deposits_isolation ON deposits FOR ALL
  USING (company_id::text = current_setting('app.company_id', true))
  WITH CHECK (company_id::text = current_setting('app.company_id', true));

ALTER TABLE change_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE change_orders FORCE ROW LEVEL SECURITY;
CREATE POLICY change_orders_isolation ON change_orders FOR ALL
  USING (company_id::text = current_setting('app.company_id', true))
  WITH CHECK (company_id::text = current_setting('app.company_id', true));

ALTER TABLE qb_sync_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE qb_sync_log FORCE ROW LEVEL SECURITY;
CREATE POLICY qb_sync_log_isolation ON qb_sync_log FOR ALL
  USING (company_id::text = current_setting('app.company_id', true))
  WITH CHECK (company_id::text = current_setting('app.company_id', true));

ALTER TABLE sms_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_threads FORCE ROW LEVEL SECURITY;
CREATE POLICY sms_threads_isolation ON sms_threads FOR ALL
  USING (company_id::text = current_setting('app.company_id', true))
  WITH CHECK (company_id::text = current_setting('app.company_id', true));

ALTER TABLE sms_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_messages FORCE ROW LEVEL SECURITY;
CREATE POLICY sms_messages_isolation ON sms_messages FOR ALL
  USING (company_id::text = current_setting('app.company_id', true))
  WITH CHECK (company_id::text = current_setting('app.company_id', true));
