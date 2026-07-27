# Owner click-through — management portal v0.1

Do this on a phone (~390 px wide) at the live URL or `npm run preview`.

1. Sign in → lands on **Today**
2. **Customers** → Add customer → open it → add a contact (Direct cannot be deleted)
3. **+** quick-create → customer + address + optional note → project in ≤30 s
4. Project screen → mark quote sent → mark approved → prepare glass PO (mailto opens) → mark glass received → hardware not needed → **gate flips** (Ready to schedule) once
5. **Pipeline** → job appears in Ready & Scheduled lane
6. **Dispatch** → book a visit → pin shows on map if geocoded (or drop pin on project)
7. **Settings** → turn on push (optional) → create a field user
8. Public form `/service/<slug>` logged out → ticket appears linked when address matches
9. Field user cannot open `/m`

## Weekly backup

```bash
npm run backup
```

Copy the `backups/*.sql` file (and R2 note) to network storage.

## Restore test (once)

1. Create a throwaway Neon project
2. `psql "$THROWAWAY_URL" < backups/glazeboard-….sql`
3. Confirm table list and rough row counts match workbench
4. Delete the throwaway project

## Cloudflare Access

Keep Access on `/m` until you decide otherwise — one extra login, second wall. Exclude `/service/*` when the public form is live.
