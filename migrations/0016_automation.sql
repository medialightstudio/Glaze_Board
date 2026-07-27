-- Automation: AI runs, mail, review queue, quotes, autonomy, messenger, drafts.

CREATE TABLE ai_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  kind text NOT NULL,
  model text,
  input jsonb NOT NULL DEFAULT '{}'::jsonb,
  output jsonb,
  confidence numeric,
  document_id uuid REFERENCES documents(id) ON DELETE SET NULL,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE command_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  user_id text,
  channel text NOT NULL,
  intent text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  confirmed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE mail_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  purpose text NOT NULL,
  email text NOT NULL,
  refresh_token text,
  access_token text,
  token_expires_at timestamptz,
  history_id text,
  watch_expiry timestamptz,
  connected_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, purpose)
);

CREATE TABLE mail_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  mail_account_id uuid REFERENCES mail_accounts(id) ON DELETE SET NULL,
  message_id text NOT NULL,
  thread_id text,
  from_addr text,
  subject text,
  received_at timestamptz,
  labeled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, message_id)
);

CREATE TABLE review_queue_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  document_id uuid REFERENCES documents(id) ON DELETE CASCADE,
  mail_message_id uuid REFERENCES mail_messages(id) ON DELETE SET NULL,
  guessed_project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  alternatives jsonb NOT NULL DEFAULT '[]'::jsonb,
  extract jsonb NOT NULL DEFAULT '{}'::jsonb,
  confidence numeric,
  status text NOT NULL DEFAULT 'open',
  resolved_by text,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE autonomy_settings (
  company_id uuid PRIMARY KEY REFERENCES companies(id),
  toggles jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  account_id uuid REFERENCES accounts(id) ON DELETE SET NULL,
  homeowner_name text,
  terms text,
  total_cents integer NOT NULL DEFAULT 0,
  crl_quote_number text,
  status text NOT NULL DEFAULT 'draft',
  share_token text UNIQUE,
  pdf_document_id uuid REFERENCES documents(id) ON DELETE SET NULL,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE quote_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  quote_id uuid NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  description text NOT NULL,
  qty numeric NOT NULL DEFAULT 1,
  unit_cents integer NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0
);

CREATE TABLE quote_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  quote_id uuid NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  viewed_at timestamptz NOT NULL DEFAULT now(),
  user_agent text
);

CREATE TABLE message_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  kind text NOT NULL,
  channel text NOT NULL DEFAULT 'email',
  body text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);

CREATE TABLE messenger_bindings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  user_id text NOT NULL,
  channel text NOT NULL DEFAULT 'telegram',
  chat_id text NOT NULL,
  bind_code text,
  bound_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (channel, chat_id)
);

CREATE TABLE exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  kind text NOT NULL,
  summary text NOT NULL,
  resolved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ai_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_runs FORCE ROW LEVEL SECURITY;
CREATE POLICY ai_runs_isolation ON ai_runs FOR ALL
  USING (company_id::text = current_setting('app.company_id', true))
  WITH CHECK (company_id::text = current_setting('app.company_id', true));

ALTER TABLE command_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE command_log FORCE ROW LEVEL SECURITY;
CREATE POLICY command_log_isolation ON command_log FOR ALL
  USING (company_id::text = current_setting('app.company_id', true))
  WITH CHECK (company_id::text = current_setting('app.company_id', true));

ALTER TABLE mail_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE mail_accounts FORCE ROW LEVEL SECURITY;
CREATE POLICY mail_accounts_isolation ON mail_accounts FOR ALL
  USING (company_id::text = current_setting('app.company_id', true))
  WITH CHECK (company_id::text = current_setting('app.company_id', true));

ALTER TABLE mail_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE mail_messages FORCE ROW LEVEL SECURITY;
CREATE POLICY mail_messages_isolation ON mail_messages FOR ALL
  USING (company_id::text = current_setting('app.company_id', true))
  WITH CHECK (company_id::text = current_setting('app.company_id', true));

ALTER TABLE review_queue_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_queue_items FORCE ROW LEVEL SECURITY;
CREATE POLICY review_queue_isolation ON review_queue_items FOR ALL
  USING (company_id::text = current_setting('app.company_id', true))
  WITH CHECK (company_id::text = current_setting('app.company_id', true));

ALTER TABLE autonomy_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE autonomy_settings FORCE ROW LEVEL SECURITY;
CREATE POLICY autonomy_isolation ON autonomy_settings FOR ALL
  USING (company_id::text = current_setting('app.company_id', true))
  WITH CHECK (company_id::text = current_setting('app.company_id', true));

ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes FORCE ROW LEVEL SECURITY;
CREATE POLICY quotes_isolation ON quotes FOR ALL
  USING (company_id::text = current_setting('app.company_id', true))
  WITH CHECK (company_id::text = current_setting('app.company_id', true));

ALTER TABLE quote_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_lines FORCE ROW LEVEL SECURITY;
CREATE POLICY quote_lines_isolation ON quote_lines FOR ALL
  USING (company_id::text = current_setting('app.company_id', true))
  WITH CHECK (company_id::text = current_setting('app.company_id', true));

ALTER TABLE quote_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_views FORCE ROW LEVEL SECURITY;
CREATE POLICY quote_views_isolation ON quote_views FOR ALL
  USING (company_id::text = current_setting('app.company_id', true))
  WITH CHECK (company_id::text = current_setting('app.company_id', true));

ALTER TABLE message_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_drafts FORCE ROW LEVEL SECURITY;
CREATE POLICY message_drafts_isolation ON message_drafts FOR ALL
  USING (company_id::text = current_setting('app.company_id', true))
  WITH CHECK (company_id::text = current_setting('app.company_id', true));

ALTER TABLE messenger_bindings ENABLE ROW LEVEL SECURITY;
ALTER TABLE messenger_bindings FORCE ROW LEVEL SECURITY;
CREATE POLICY messenger_bindings_isolation ON messenger_bindings FOR ALL
  USING (company_id::text = current_setting('app.company_id', true))
  WITH CHECK (company_id::text = current_setting('app.company_id', true));

ALTER TABLE exceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE exceptions FORCE ROW LEVEL SECURITY;
CREATE POLICY exceptions_isolation ON exceptions FOR ALL
  USING (company_id::text = current_setting('app.company_id', true))
  WITH CHECK (company_id::text = current_setting('app.company_id', true));
