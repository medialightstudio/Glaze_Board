-- Full-text + trigram indexes for header search.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE projects ADD COLUMN IF NOT EXISTS search_tsv tsvector;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS search_tsv tsvector;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS search_tsv tsvector;

CREATE OR REPLACE FUNCTION glaze_projects_search_tsv() RETURNS trigger AS $$
BEGIN
  NEW.search_tsv :=
    setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.site_address, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.address_norm, '')), 'B');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER projects_search_tsv_tg
  BEFORE INSERT OR UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION glaze_projects_search_tsv();

CREATE OR REPLACE FUNCTION glaze_contacts_search_tsv() RETURNS trigger AS $$
BEGIN
  NEW.search_tsv :=
    setweight(to_tsvector('english', coalesce(NEW.name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.phone, '')), 'B');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER contacts_search_tsv_tg
  BEFORE INSERT OR UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION glaze_contacts_search_tsv();

CREATE OR REPLACE FUNCTION glaze_accounts_search_tsv() RETURNS trigger AS $$
BEGIN
  NEW.search_tsv := to_tsvector('english', coalesce(NEW.name, ''));
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER accounts_search_tsv_tg
  BEFORE INSERT OR UPDATE ON accounts
  FOR EACH ROW EXECUTE FUNCTION glaze_accounts_search_tsv();

CREATE INDEX projects_search_tsv_idx ON projects USING GIN (search_tsv);
CREATE INDEX projects_title_trgm_idx ON projects USING GIN (title gin_trgm_ops);
CREATE INDEX projects_address_trgm_idx ON projects USING GIN (site_address gin_trgm_ops);
CREATE INDEX contacts_name_trgm_idx ON contacts USING GIN (name gin_trgm_ops);
CREATE INDEX contacts_phone_trgm_idx ON contacts USING GIN (phone gin_trgm_ops);
CREATE INDEX accounts_name_trgm_idx ON accounts USING GIN (name gin_trgm_ops);
CREATE INDEX glass_orders_po_trgm_idx ON glass_orders USING GIN (po_number gin_trgm_ops);
CREATE INDEX hardware_orders_num_trgm_idx ON hardware_orders USING GIN (order_number gin_trgm_ops);
