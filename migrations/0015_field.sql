-- Field visit completion + access fields on projects.

ALTER TABLE visits
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS punch_list jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS complete_note text,
  ADD COLUMN IF NOT EXISTS signature_document_id uuid REFERENCES documents(id) ON DELETE SET NULL;

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS lockbox_code text,
  ADD COLUMN IF NOT EXISTS access_notes text,
  ADD COLUMN IF NOT EXISTS measurements jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS quote_price_cents integer,
  ADD COLUMN IF NOT EXISTS margin_glass_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS margin_hardware_cents integer NOT NULL DEFAULT 0;
