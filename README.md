# Glaze Board

Management system for a small custom glass installation company (glazeboard.com). Specs live in `docs/`; Next.js app on Cloudflare Workers (OpenNext).

## Folder map

```
.gitignore
.cursorignore
LICENSE
README.md
BUILD-LOG.md
.cursor/rules/00-standing-orders.mdc
docs/                  the specification (read-only)
src/app/m/…            management portal routes
src/app/f/…            field portal (shell only for now)
src/app/c/…            contractor portal (blocked page only)
src/app/api/…          route handlers
src/components/…       shared UI, one component per file
src/lib/…              colors.ts, money.ts, utils.ts (+ later modules)
migrations/            plain SQL, applied in order
scripts/               check-guard, check-size (+ migrate/seed later)
```

## Git conventions

- **Default branch:** `main` (production / deploy target)
- **Work branches:** `cursor/<short-name>-67fa` for agent work; human feature work may use the same style or short topic names
- **Commits during the build:** `<step id> <short description>` (e.g. `A2 repo skeleton`) once the operator says “Approved”
- **PR base:** `main`
- **Protected paths:** never commit `.env*`, `userconfig.md`, or secrets; refuse the commit if `.gitignore` would miss them
- **Migrations:** never rewrite an applied migration; code reverts with git, databases do not

## Setup (owner)

See [docs/owner-checklists.md](docs/owner-checklists.md) for Neon `glaze_app`, `.env.local` blanks, Cloudflare secrets, Access, R2, and Turnstile.

```bash
npm install
# fill .env.local (never commit it)
npm run migrate
npm run dev
npm run seed -- --company "Your Company" --email you@example.com --password '…' --name "You"
```

## License

Proprietary. Copyright © 2026 Glaze Board / Media Light Studio / David K. Nobody is granted permission to use this code. See [LICENSE](LICENSE).

## Clean code from the first file

- Every file opens with a 1–2 line plain-English comment saying what it does.
- Files ≤ ~200 lines, one purpose each.
- **Reuse the sibling pattern:** before writing any new screen, route, table, or component, open the existing one of the same kind and copy its structure.
- Plain, boring code. No cleverness, no speculative abstraction, no TODOs, no commented-out code, no dead code — delete instead.
- All status changes go through `status-machine.ts`. All database access goes through `db.ts`, built on `db-core.ts`. UI files never contain raw SQL.
- **Money is whole cents in integer columns** — never a decimal type in code; format only at display, via `money.ts`.
- **All timestamps carry a time zone.** Business-day and hour-of-day rules compute in the company's time zone.
- **Vendor firewall:** outside services touched only through `src/lib` modules; nothing vendor-proprietary beyond the approved list.
- **Forbidden constructs:** `SET` without `LOCAL` · `set_config(...)` with `false` as the third argument · `export const runtime = 'edge'` · any browser storage API. Each of these silently breaks isolation or the runtime.
- Every user-visible string in plain English a non-developer would write.

## Database rules (never violate)

- **Migrations only go forward.** Never rewrite an applied migration. The undo during the build is `npm run db:reset`, which rebuilds the workbench from all migrations plus seed data. Code reverts with git; databases do not.
- Every business table: `ENABLE` **and** `FORCE ROW LEVEL SECURITY`, in the same migration that creates it.
- The app connects with the limited `glaze_app` account (owns nothing); migrations use the owner account.
- Only `db-core.ts` connects. Business reads go through `withUser`; the login library's own tables go through `readAuth`; the public service form goes through `systemContext`.
