# Deploy Glaze Board to Cloudflare (glazeboard.com)

The app is an OpenNext Worker named **`glazeboard`**. Custom domains `glazeboard.com` and `www.glazeboard.com` are declared in `wrangler.jsonc`.

## A — One-time Cloudflare setup (dashboard)

### 1. Workers Builds (GitHub connected)

Change the build settings you already have:

| Setting | Value |
|--------|--------|
| Repository | `medialightstudio/Glaze_Board` |
| Production branch | `main` |
| Root directory | `/` |
| **Build command** | `npx @opennextjs/cloudflare build` |
| **Deploy command** | `npx @opennextjs/cloudflare deploy` |
| Build variables | none required (secrets are Worker secrets, not build vars) |

Workers Builds already runs `npm clean-install` for you — do not rely on bare `npx wrangler deploy` alone.

**If you see:** `Could not find compiled Open Next config, did you run the build command?`  
→ Build command is empty/`None`, or Deploy is still `npx wrangler deploy` without a prior OpenNext build. Fix both rows above and retry.

**Fallback (all-in-one Deploy command, Build can stay empty):**

```text
npx @opennextjs/cloudflare build && npx @opennextjs/cloudflare deploy
```

### 2. R2 bucket

Create bucket named **`docs`** (matches `wrangler.jsonc` binding `DOCS`), or run after login:

```bash
npx wrangler r2 bucket create docs
```

### 3. Worker secrets (Settings → Variables and Secrets)

Paste these **secret** names (values from your workbench `.env.local`, or live Neon when you split environments):

- `DATABASE_URL` — `glaze_app` connection string  
- `MIGRATE_DATABASE_URL` — owner connection string (only if you migrate from CI; otherwise migrate from laptop)  
- `BETTER_AUTH_SECRET`  
- `RESEND_API_KEY`  
- `VAPID_PUBLIC_KEY`  
- `VAPID_PRIVATE_KEY`  
- `VAPID_SUBJECT` — e.g. `mailto:support@glazeboard.com`  
- `TURNSTILE_SECRET_KEY` — optional until public form  

Already set as plain **vars** in `wrangler.jsonc`:

- `BETTER_AUTH_URL` = `https://glazeboard.com`  
- `NEXTJS_ENV` = `production`

### 4. Custom domain

After the first successful deploy:

- Workers → `glazeboard` → Domains & Routes  
- Confirm `glazeboard.com` and `www` (wrangler also declares them)  
- DNS for the domain should stay on Cloudflare  

### 5. Cloudflare Access (recommended until public form is live)

- Zero Trust → Access → Application covering `glazeboard.com`  
- Later exclude `/service/*` when the public service form goes live  

## B — Deploy from this repo (CLI)

```bash
npx wrangler login
npx wrangler r2 bucket create docs   # once
npm run cf:secrets                   # pushes .env.local → Worker secrets
npm run deploy                       # OpenNext build + deploy
```

## C — Ship via GitHub

1. Merge the feature branch into **`main`**  
2. Workers Builds runs the build + deploy commands above  
3. Confirm https://glazeboard.com/login  

## After deploy — seed live (if empty)

If live DB is empty, migrate + seed from your laptop pointed at live URLs (keep laptop `.env.local` on workbench after):

```bash
# temporarily use live URLs only for this step, then switch back
npm run migrate
npm run seed -- --company "Lumex" --email "you@example.com" --password '…' --name "You"
```

Or run migrate once against live with `MIGRATE_DATABASE_URL`, then seed while `BETTER_AUTH_URL=https://glazeboard.com` and the site is up.

## Live status

Deployed Worker: `glazeboard`  
URLs: https://glazeboard.com · https://www.glazeboard.com · https://glazeboard.medialightstudia.workers.dev

**R2:** `wrangler.jsonc` includes the `DOCS` → `docs` binding again. Before deploy: Dashboard → R2 → enable → create bucket `docs` (or `npm run cf:r2`).

**Cron:** `wrangler.jsonc` declares `*/10 * * * *` and `0 14 * * *`. OpenNext does not auto-map those to Next routes — wire one of:
1. Cloudflare Worker scheduled event that `fetch`es `https://glazeboard.com/api/cron` (poll) and `.../api/cron?job=digest` with `Authorization: Bearer $CRON_SECRET`
2. Or an external cron (same URLs). Also `?job=qb_payments` for QuickBooks balance sync.

