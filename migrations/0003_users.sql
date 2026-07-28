-- Extend Better Auth user — never a second users table (DEC-23). Add company timezone default.

ALTER TABLE "user"
  ADD COLUMN company_id uuid REFERENCES companies(id),
  ADD COLUMN role text NOT NULL DEFAULT 'field',
  ADD COLUMN platform_admin boolean NOT NULL DEFAULT false,
  ADD COLUMN active boolean NOT NULL DEFAULT true,
  ADD COLUMN phone text;

CREATE INDEX user_company_id_idx ON "user" (company_id);

-- companies.timezone already defaulted in 0001; ensure column exists for older paths
ALTER TABLE companies
  ALTER COLUMN timezone SET DEFAULT 'America/Los_Angeles';
