# Glaze Board — Build Log

Append-only. Numbered entries; never dated. Never edit past entries.

## Entry 1 — A2 — Repo skeleton
Built: Cloudflare/Next Workers scaffold with approved deps, shadcn subset, folder map, colors/money helpers, and check scripts. Files: package.json, wrangler.jsonc, open-next.config.ts, next.config.ts, src/app/*, src/components/ui/*, src/lib/colors.ts, src/lib/money.ts, src/lib/utils.ts, scripts/check-guard, scripts/check-size, .gitignore, README.md. Followed: docs/4-build-ledger.md §A2; docs/3-decisions.md DEC-11, DEC-30; standing orders folder map + approved deps.
Decisions: none. Model: sonnet.
Checks: dev ✅ lint n-a guard ✅ (MODEL=sonnet) preview ✅ rls n-a size 776.59 KiB. Commit: "A2 repo skeleton"

## Entry 2 — A3–A7 — Foundation (Grok override batch)
Built: env templates, migrate/reset, db-core, migrations 0001–0003, Better Auth, login, middleware, /m /f /c shells, owner live checklist. Followed: ledger A3–A7; DEC-21, DEC-23, DEC-24.
Decisions: operator override — batch on Grok; secrets pause until .env.local filled. Model: grok.
Checks: guard ✅ (MODEL=grok); rls blocked until secrets. Commit: "A-F foundation through service"

## Entry 3 — B1–B6 — Customers and projects
Built: migrations 0004–0006, db helpers, address+check:addr, status-machine, customers UI, quick-create, project screen. Followed: ledger B.
Decisions: none. Model: grok.
Checks: check:addr ✅.

## Entry 4 — C1–C3 — Orders and gate
Built: migrations 0007–0009, glass/hardware API, DEC-28 gate in transition layer, notifications. Followed: ledger C; DEC-28.
Decisions: none. Model: grok.

## Entry 5 — D1–D3 — Boards and search
Built: Today view, five-lane pipeline, migration 0010, header search. Followed: ledger D; DEC-32.
Decisions: none. Model: grok.

## Entry 6 — E1–E2 — Documents
Built: migration 0011, R2 DOCS binding, storage.ts, upload/download routes. Followed: ledger E.
Decisions: none. Model: grok.

## Entry 7 — F1–F2 — Schedule and service
Built: migrations 0012–0013, visits/dispatch, public /service/[slug], matching.ts, tickets. Followed: ledger F.
Decisions: none. Model: grok.
Checks: owner must complete Access exclude, Turnstile, rate-limit (docs/owner-checklists.md).
