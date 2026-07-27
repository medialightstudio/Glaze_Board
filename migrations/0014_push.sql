-- Web push subscriptions + per-user notification toggle.

CREATE TABLE push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  user_id text NOT NULL,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, endpoint)
);

ALTER TABLE "user"
  ADD COLUMN IF NOT EXISTS push_enabled boolean NOT NULL DEFAULT false;

CREATE INDEX push_subscriptions_user_idx ON push_subscriptions (company_id, user_id);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions FORCE ROW LEVEL SECURITY;

CREATE POLICY push_subscriptions_isolation ON push_subscriptions FOR ALL
  USING (company_id::text = current_setting('app.company_id', true))
  WITH CHECK (company_id::text = current_setting('app.company_id', true));
