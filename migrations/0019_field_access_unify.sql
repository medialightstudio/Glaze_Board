-- Unify lockbox onto access_lockbox_code (0005); copy from 0015 lockbox_code then drop.

UPDATE projects
SET access_lockbox_code = COALESCE(NULLIF(access_lockbox_code, ''), lockbox_code)
WHERE lockbox_code IS NOT NULL;

ALTER TABLE projects DROP COLUMN IF EXISTS lockbox_code;
