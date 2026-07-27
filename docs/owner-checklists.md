# Owner checklists — Phase gates A–F

The agent never opens `userconfig.md` and never asks you to paste secrets into chat. Fill blanks locally or in the Cloudflare dashboard.

## Secrets pause (before A4 verify)

1. In Neon SQL editor, create the app role (owns nothing):

```sql
CREATE ROLE glaze_app LOGIN PASSWORD 'choose-a-strong-password';
GRANT CONNECT ON DATABASE neondb TO glaze_app;
GRANT USAGE ON SCHEMA public TO glaze_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO glaze_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO glaze_app;
```

2. Open `.env.local` on your machine and fill:

| Line | What to paste |
|------|----------------|
| `DATABASE_URL` | Neon connection string for **glaze_app** |
| `MIGRATE_DATABASE_URL` | Neon connection string for the **owner** role |
| `BETTER_AUTH_SECRET` | Run `openssl rand -base64 32` and paste the result |
| `BETTER_AUTH_URL` | `http://localhost:3000` locally; `https://glazeboard.com` in Cloudflare |
| `RESEND_API_KEY` | Your Resend API key |

3. Tell the agent secrets are filled (do not paste the values). Then run:

```bash
npm run migrate
npm run dev
# in another terminal, with the app up:
npm run seed -- --company "Your Company" --email you@example.com --password '…' --name "Your Name"
npm run check:rls
```

## A7 — Live deploy

Cloudflare secret **names** (values you paste in the dashboard):

- `DATABASE_URL` (live glaze_app)
- `MIGRATE_DATABASE_URL` (live owner — only if you run migrate from CI; otherwise migrate locally against live once)
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL` = `https://glazeboard.com`
- `RESEND_API_KEY`

Also:

1. Create Neon project `glazeboard-live` + `glaze_app` role
2. Workers Builds: Build command `npx @opennextjs/cloudflare build` · Deploy `npx @opennextjs/cloudflare deploy`
3. Put **Cloudflare Access** in front of the whole site
4. Keep laptop `.env.local` on workbench only

## E — R2 documents

- Ensure R2 bucket named `docs` exists (wrangler binding `DOCS`)
- Confirm the binding on the Worker

## F — Public service form

- Add Turnstile site/secret keys (`TURNSTILE_SECRET_KEY` in Cloudflare secrets; site key to the form when you wire the widget)
- Cloudflare Access: exclude `/service/*`
- Rate-limiting rule on `/service/*`

## G — Push (VAPID)

Add these Cloudflare secrets (same names as `.env.local`):

- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT` (e.g. `mailto:support@glazeboard.com`)

Generate locally if needed:

```bash
node -e "console.log(require('web-push').generateVAPIDKeys())"
```
