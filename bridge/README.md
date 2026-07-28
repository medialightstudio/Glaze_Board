# CRL Bridge (L1/L2) — isolated worker

Optional Playwright worker. **Off until D4 (CRL ToS).** Glaze Board L0 never touches CRL’s site.

## Contract

1. `POST /api/bridge/claim` with header `x-bridge-secret` → next `queued` job
2. Run Playwright against Showers Online: create shell, enter dimensions, **pause**
3. `PATCH /api/bridge/jobs/:id` `{ action: "checkpoint", screenshot_key, company_id }`
4. On failure: `{ action: "fail", error }` → office falls back to L0 copy panel
5. L2: fill cart from BOM, **stop before checkout**

## Run (local)

```bash
export BRIDGE_SHARED_SECRET=…
export GLAZEBOARD_URL=https://glazeboard.com
export DEFAULT_COMPANY_ID=…
node bridge/worker.mjs
```

Playwright is intentionally not a Glaze Board app dependency — install it only in the bridge environment.
