# AGENTS.md

## Cursor Cloud specific instructions

### Repository state (read first)
This repo (`glazeboard`) is currently **specification-only** — it contains planning
documents, not an application. There is intentionally **no `package.json`, `src/`,
`migrations/`, lockfile, or `.env.example` yet**. Do not treat a missing app as broken.

The docs are the source of truth and drive all work:
- `00-standing-orders.mdc` — executor rules (one step at a time, protected files, model gates, secrets discipline).
- `1-product.md`, `2-systems.md`, `3-decisions.md` — what/why to build.
- `4-build-ledger.md` — the numbered steps to execute, one per prompt.

Per `4-build-ledger.md`, the project sits at **"A1 — DONE / Begin at A2"**. Step **A2**
is the first step that creates code: it scaffolds a Next.js + Cloudflare Workers app via
`npm create cloudflare@latest -- _new --framework=next --platform=workers` and then adds
the approved dependencies. **Nothing is runnable until A2 has been executed.**

### Toolchain (already present on the VM)
- Node 22 LTS (`node -v` → v22.x) and npm — matches ledger step A1.
- git.
- `psql` (Postgres client) is **not** installed and is not needed yet: every DB step
  requires owner-provisioned Neon accounts/keys (`DATABASE_URL`, `MIGRATE_DATABASE_URL`),
  so those steps cannot run in this environment without secrets regardless.

### Running / testing (only meaningful AFTER the app is scaffolded)
Once step A2 exists, use the scripts the ledger defines (see `4-build-ledger.md`), e.g.
`npm run dev`, `npm run preview` (true Cloudflare Workers runtime), `npm run lint`, and the
check scripts `check:guard` / `check:size` / `check:rls` / `check:addr`, plus `migrate`,
`db:reset`, `seed`, `backup`. Do not invent these scripts early — each is introduced by the
step that creates it. `npm create cloudflare@latest` is interactive and has network/download
side effects; only run it as part of deliberately executing step A2, never as a smoke test.

### Secrets discipline (hard rule from the docs)
Never open or read `userconfig.md`, and never ask for or print credential values. When a
step needs config, create `.env.local` with variable **names and blank values** only, and
ensure `userconfig.md` and `.env*` are git-ignored before any commit.
