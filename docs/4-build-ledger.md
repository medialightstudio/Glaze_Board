# Glaze Board — Build Ledger: Management Portal

Execute strictly in order, one step per prompt, under the standing orders. Default model **Composer**; **[SONNET]** steps require the switch ritual. Every step ends with the self-check ritual: verify → report → (Sonnet steps: plain-English paragraph) → log → commit → brief the owner → stop. No dates anywhere — sequence only.

**Step-size rule:** a step is right-sized if its verify checklist is five clicks or fewer, it touches five files or fewer, and it can be described in one sentence without the word "and."

---

## PHASE A — Foundation **[SONNET — the entire phase]**

Phase A creates migrations, security, login, and configuration — all protected files. Running it on Composer would collide with the protected-file rule and halt on step one. The cost difference is a rounding error; a quiet mistake here is permanent.

### A1 — Accounts — **DONE**
Cursor, Node 22 LTS, Git, Postgres client tools installed · GitHub private repo `glazeboard` · Cloudflare account + glazeboard.com · Neon project · Resend key. **Begin at A2.**

### A2 — Repo skeleton
1. **First:** create/verify `.gitignore` (`userconfig.md`, `.env*`, `node_modules`, `.next`, `.open-next`, `.wrangler`) and `.cursorignore` (`.env*`, `userconfig.md`, `docs/archive/`). Confirm `git status` does not list `userconfig.md`.
2. Scaffold: `npm create cloudflare@latest -- _new --framework=next --platform=workers` (TypeScript, Tailwind, `src/`, App Router), then move the contents of `_new/` up into the repo root and delete `_new/`. **If a scaffolder ever reports the directory is not empty, never force it** — scaffold into `_new/` and move.
3. Install the approved runtime dependencies (exact names, nothing more). Init shadcn/ui; add only `button card input dialog badge sheet`.
4. Create the folder map from the standing orders (`.gitkeep` in empty folders). Install the standing orders at `.cursor/rules/00-standing-orders.mdc`. Create `BUILD-LOG.md` with a one-line header.
5. `README.md`: plain-English folder map + the "Clean code" and "Database rules" sections from the standing orders, verbatim.
6. `src/lib/colors.ts` (the four task colors, comment "DEC-11") and `src/lib/money.ts` (cents ⇄ display helpers, comment "DEC-30").
7. `scripts/check-guard` + `scripts/check-size` and npm scripts `check:guard`, `check:size`: the first fails if changed files intersect the protected list while the session model isn't Sonnet (read from a `MODEL` env var the operator sets, default composer); the second prints the compressed Worker size from a dry-run build.
8. First commit; push to GitHub.
**Verify:** `npm run dev` and `npm run preview` both serve the starter page; repo on GitHub; `userconfig.md` absent from it; `check:size` prints a number.

### A3 — Database plumbing
1. `.env.example` with names only: `DATABASE_URL` (app account), `MIGRATE_DATABASE_URL` (owner account), `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `RESEND_API_KEY`. Create `.env.local` with the same names and **blank values**, then tell the owner in plain words which value goes on which line, including the command to generate the auth secret. **Never open `userconfig.md`; never ask for a value.**
2. Guide the owner to create a second Neon role `glaze_app` (connect + select/insert/update/delete, owns nothing) — give the exact SQL for Neon's console and say which connection string goes in which variable.
3. `scripts/migrate` + npm `migrate`: applies `/migrations/*.sql` in filename order using `MIGRATE_DATABASE_URL`, records applied files in `_migrations`, fails loudly. `scripts/reset` + npm `db:reset`: rebuilds the workbench from all migrations plus seed; refuses to run against the live connection string.
4. `src/lib/db-core.ts` — the single database door, using the Neon driver's **`Pool`** (connection mode, not the single-shot HTTP mode, which cannot hold a transaction). Exactly three exported functions:
   - `withUser(session, fn)` — take a connection → `BEGIN` → `SELECT set_config('app.company_id', $1, true)` and the same for `app.role` (third argument **true** = request-scoped) → run the caller's queries → `COMMIT` → release.
   - `readAuth(fn)` — the login library's own tables only (DEC-23).
   - `systemContext(companyId, fn)` — for the public service form; its policy permits inserting tickets only.
   `SET` without `LOCAL` and `set_config(..., false)` are forbidden: they outlive the request and follow the connection to the next user.

### A4 — Foundation schema & isolation
1. Migration `0001_companies`: `companies` per the data model, `ENABLE` **and** `FORCE ROW LEVEL SECURITY` (Postgres exempts a table's owner from its own policies unless forced — DEC-21). Policies read `current_setting('app.company_id')`. Comment cites DEC-3 and DEC-21.
2. Migration `0002_auth`: the login library's generated schema, unchanged. **These tables are exempt from company filtering** and reachable only through `readAuth` (DEC-23) — the comment says why: a session must be read before the company is known.
3. Migration `0003_users`: extend the library's `user` table with `company_id`, `role`, `platform_admin`, `active`, `phone` via the library's extra-fields feature — **do not create a second users table**. Add `companies.timezone` (default `America/Los_Angeles`).
4. `scripts/check-rls` + npm `check:rls`: creates two throwaway companies and users **through the login library's sign-up function, never raw SQL**; asserts every cross-company read returns zero rows via `db-core` *and* via a raw policy probe; asserts **the app account owns no tables**; cleans up; exits non-zero on any leak.
**Verify:** `npm run migrate` succeeds; `npm run check:rls` passes.

### A5 — Login
1. Better Auth wired: email + password; sessions carry `company_id` and `role` for `withUser`.
2. Sign-in page + logout in a placeholder header.
3. Password reset via Resend. (The owner must verify glazeboard.com in Resend first — the DNS records go in Cloudflare, where he owns the domain.)
4. `scripts/seed` + npm `seed`: creates the company (name from the operator at run time) and the owner's admin account **by calling the login library's sign-up function** — a hand-written SQL row has no valid password and cannot log in. Run it.
**Verify:** the owner logs in with his own email and password; a wrong password is refused.

### A6 — Shell & routing
1. `middleware.ts`: unauthenticated → login; admin/manager → `/m`; field → `/f`; `/c` shows "coming later". Office roles may also open `/f` for oversight; field roles may never open `/m`.
2. `/m` layout: sidebar (desktop) with both wings + Settings; mobile bottom tabs (five Operations items + "More"). Every nav target is a titled empty state ("Nothing here yet — arrives in Phase X").
3. Header: company name, disabled search placeholder, user menu with logout.
**Verify:** every nav item opens; usable at 390 px; a field-role test user cannot reach `/m`.

### A7 — Live database & first deploy (DEC-24)
1. Owner creates Neon project `glazeboard-live` and its `glaze_app` role; agent lists the secret **names** for Cloudflare; owner pastes the values in the dashboard.
2. Run all migrations fresh against live; seed the real company + owner admin.
3. Connect the GitHub repo to Cloudflare Workers Builds (push-to-deploy); attach glazeboard.com.
4. Put **Cloudflare Access** in front of the whole site (free, ten minutes) — a second wall until the public form arrives in Phase F.
5. `npm run check:size` — report the compressed Worker size; over 2.5 MB, note `OBSERVED` (free plan caps at 3 MB; the $5 plan at 10 MB).
**Verify:** the owner logs in at glazeboard.com from his phone. `.env.local` still holds workbench keys — the laptop never points at live.
**PHASE GATE A** → `NEXT PHASE STARTS ON MODEL: Composer (Sonnet for tagged steps).`

---

## PHASE B — Customers & Projects · **this phase ends with real jobs in the live app**

### B1 — Customers & contacts
1. **[SONNET]** Migration `0004_customers`: `accounts`, `contacts`, `teams` (RLS enabled + forced, pattern copied from `0001`). Seed the built-in "Direct" account.
2. `src/lib/db.ts`: typed helpers for accounts/contacts, built on `db-core` — later steps extend here, never touching security wiring.
3. `/m/customers`: table + "Add customer" dialog (name required; phone/email/billing type optional; billing defaults per_job).
4. `/m/customers/[id]`: header, contacts list with add-contact dialog, empty Projects/Unbilled sections labeled for later phases.
**Verify:** create a customer + contact in under 30 seconds; "Direct" can't be deleted.

### B2 — Users & Team
1. Settings → Users (admin only): create a user (name, email, role); send an invite via Resend or set a temporary password — **always through the login library's sign-up function**; deactivate a user; name Team 1's two members.
**Verify:** invite one real colleague; he logs in and lands on `/f`, not `/m`.

### B3 — Projects & quick-create
1. **[SONNET]** Migration `0005_projects`: `projects` + `project_contacts` (status enum; `address_norm`; `address_unit`; `zip`; `lat`/`lng` nullable; `job_type`; `gate_fired_at`).
2. `src/lib/address.ts`: `normalizeAddress()` — lowercase, trim, collapse spaces, strip punctuation; street-type map (street→st, avenue→ave, drive→dr, road→rd, boulevard→blvd, lane→ln, court→ct); **compass map** (north→n, south→s, east→e, west→w); **unit split** (suite/unit/apt/# → `address_unit`, kept out of `address_norm`); **ZIP stored separately**, required to match when both sides have one. Thirteen plain-assertion tests behind `npm run check:addr`, including "42 Oak St Apt 2" vs "42 Oak St #2" (match) and "42 Oak St" vs "44 Oak St" (no match).
3. Quick-create sheet from a persistent "+": customer picker with instant add-new · site address · optional note. **Exactly three required inputs**; `job_type` sits on the optional row. Auto-title.
4. New projects land in `lead`; the customer page lists theirs.
**Verify:** on a phone, a project created in ≤30 s with ≤3 inputs.

### B4 — Status machine & activity feed **[SONNET]**
1. Migration `0006_feed`: `activity_events`, `approvals`.
2. `src/lib/status-machine.ts`: the transition table from the product spec encoded as data; one exported `transition(projectId, to, actor, payload)` — **the only way any code changes status**. Validates, stamps per-status timestamps, appends the feed event with evidence.
3. `undo(eventId)`: back one step, both entries kept, linked.
4. On Hold / Lost: reason required (1 field), hold follow-up defaulted +7 days; resume returns to the exact prior status read from the feed.
5. `recordApproval()`: approvals row (combined kind, method, optional note/attachment) then transition to approved. Out-of-order jumps allowed and feed-noted.
**Verify:** full walk lead → approved; an illegal jump refused in plain words; undo restores; the feed shows every hop with actor and time.

### B5 — Project screen
1. `/m/projects/[id]`: header · contacts block with role chips and tap-to-call/text · access row (lockbox + notes) · placeholder track chips · **exactly one next-action button** · activity feed newest-first · details drawer with placeholders.
2. **Feed refresh:** poll every 30 seconds, only while the tab is visible, stopping after ten minutes without interaction — this protects the free database allowance.
3. Status changes are single taps; backward moves confirm. "Mark approved" = one tap → optional note + optional attachment, both skippable.
**Verify:** a project's whole story reads by scrolling one screen; every advance is one tap.

### B6 — Go live for real
1. Deploy (push to main). The owner adds his real customers and two or three live jobs.
2. Cloudflare Access stays on until Phase F.
**PHASE GATE B — this is the launch.** From here the shop runs on Glaze Board, and C–G improve a system already in use. Deploy at the end of every phase.

---

## PHASE C — Orders & The Gate

### C1 — Glass orders
1. **[SONNET]** Migration `0007_glass`: `glass_orders` incl. `parent_order_id`; status list includes **`not_needed`**; PO sequence `GF-{YYYY}-{NNNN}` per company; prices in cents.
2. "Prepare order": generates the PO number + a copyable block (rows editor: qty, size, glass type, note) **and a ready-made email link** — subject pre-filled `PO GF-2026-0142 — 42 Oak St`, body pre-filled with the block. One click opens the owner's mail program with everything filled; he presses send. The system still sends nothing (DEC-10). Then one-tap "PO sent."
3. Chip + advance menu: acknowledged (their order #, price, promised date), shipped, received, not needed — each a ≤1-field prompt; late and duplicate updates idempotent.
4. Remake: on a received order, creates a child order (own PO, reason) without regressing the project; "awaiting remake" chip appears.
**Verify:** full track walk; the email link opens pre-filled; remake creates a child.

### C2 — Hardware orders
1. **[SONNET]** Migration `0008_hardware`: `hardware_orders`, status list includes **`not_needed`**; costs in cents.
2. Chip + advance: in_cart → ordered (CRL order #, will-call/delivery) → received; "partially received" + missing note that does **not** count as received; "not needed" in one tap (mirror and railing jobs often have no hardware).
**Verify:** partials show everywhere the chip shows; only full received counts.

### C3 — The Gate **[SONNET]**
1. Migration `0009_notifications`: in-app `notifications`.
2. **In the transition layer, not the UI**, implement the gate in exactly these words (DEC-28): *glass is satisfied when the project has at least one glass order and every one is Received, or the glass track is Not Needed; hardware is satisfied when it is Received or Not Needed; the gate fires only when both are satisfied **and at least one track actually reached Received**.* On firing: set `gate_fired_at` (the bell rings once per opening), `transition(ready_to_schedule, actor: system)`, notify all office users, feed entry naming both evidence records. Reopening either track clears `gate_fired_at` and drops the project back to ordering with the reason.
3. Bell icon with unread count; notification list page.
**Verify:** a shower job with both tracks received flips itself and rings once. **A mirror job with hardware Not Needed and glass received also flips.** A project with zero orders never flips. Run `check:rls`.
**PHASE GATE C.** Deploy.

---

## PHASE D — Boards & The Day

### D1 — Pipeline board
1. `/m/pipeline`: **five lanes, not eleven columns** (DEC-32) — Sales (Lead, Measure Scheduled, Measured, Quote Sent) · Ordering (Approved, Ordering) · Ready & Scheduled (Ready to Schedule, Install Scheduled) · Installed · Billing (Invoiced, Paid); On Hold/Lost collapsed. Cards show name, customer, exact status, days-in-status (amber >7), glass + hardware mini-chips. Card → project; chip tap → advance menu.
2. Tap-advance first; drag between lanes last (moves to that lane's first status; backward confirms). If drag fights, drop it and note `OBSERVED`.

### D2 — Today view
1. `/m` root, sections in exact order: urgent tickets (placeholder until F2) → today's visits (placeholder until F1) → Ready-to-Schedule → will-call ready → exceptions placeholder. One card, one action each. Empty state verbatim: "Nothing needs you. Enjoy it."

### D3 — Search
1. **[SONNET]** Migration `0010_search`: full-text + trigram indexes across projects (title, address), contacts (name, phone), accounts, order and PO numbers.
2. Header search: grouped results, keyboard-navigable, debounced, deep links.
**Verify:** a partial address, a PO number, or a phone finds the right record in under a second.
**PHASE GATE D.** Deploy.

---

## PHASE E — Documents

### E1 — Storage **[SONNET]**
1. Migration `0011_documents`: `documents` (+ `mime`, `size`).
2. R2 bucket `docs` bound in the wrangler config; `src/lib/storage.ts` the only touchpoint; **every upload and download passes through our API routes, which check the documents table first — the app is the gate, the bucket is never public.** Use the Cloudflare adapter's development binding so local development runs the same code path as production — **no separate disk fallback** (one path, exercised daily).

### E2 — Upload & view
1. Drag-drop zone + Upload button on the project screen; type defaults by extension; files render in the feed. Inline image preview; PDF opens in a new tab; download link; also listed in the details drawer.
**Verify:** drop a PDF and a photo from a phone; both appear; the second test company's user cannot fetch either file (`check:rls` extended to storage routes).
**PHASE GATE E.** Deploy.

---

## PHASE F — Schedule & Service

### F1 — Visits & schedule
1. **[SONNET]** Migration `0012_visits`: `visits`. **Visits are the only record of who is on a job** (DEC-29).
2. Booking sheet: date/time, person(s) or Team, duration default 2 h, type auto by context; booking a measure or install also calls the matching transition.
3. `/m/dispatch` v1: week lanes per person (map arrives in G1); colors from `colors.ts`; drag to move; team visits on both lanes.
4. Per-visit "Add to calendar" (.ics download); emailed invites arrive in a later ledger.
5. Today lists today's visits with map links (plain map URLs — free).

### F2 — Service desk
1. **[SONNET]** Migration `0013_tickets`: `tickets` + `companies.public_form_slug`.
2. Public form at **`/service/[slug]`**: the server resolves the company from the slug and inserts via `systemContext(companyId)`, whose policy permits inserting tickets only — an anonymous visitor has no session, so the company must come from the URL. Fields: phone\*, address\*, issue, optional photos/name/email. **Cloudflare Turnstile** on the form; server-side zod validation. **No in-memory rate limiter** — it cannot work when each request may run in a fresh copy of the app; use a Cloudflare rate-limiting rule in the dashboard instead (free, no code).
3. Exclude `/service/*` from Cloudflare Access so customers can reach it; everything else stays behind Access.
4. Service board `/m/service` + Ticket screen; manual "New ticket" in ≤15 s; from a project, one tap + one line.
5. **[SONNET]** `src/lib/matching.ts`: exact `address_norm` (+ unit, + ZIP when both present) → auto-link; else phone → auto-link; else fuzzy name → top-3 manual pick; otherwise `no_match`. 48 h dedupe by phone **or** address → merge, second source noted. Warranty proposal (install ≤1 yr), unconfirmed until a human taps.
**Verify:** submit the form logged-out on a phone against a real past job's address → the ticket appears linked, warranty proposed, "leak" flagged urgent; a duplicate merges.
**PHASE GATE F.** Deploy.

---

## PHASE G — Map, PWA, Hardening

### G1 — Maps
1. `src/lib/maps/` adapter: `geocode(address)` and `<MapView pins=[…]>`; implementations `osm.ts` (active) and `google.ts` (empty stub, "DEC-16 upgrade slot").
2. `osm.ts`: Leaflet + OpenStreetMap tiles with attribution; Nominatim geocoding behind a 1-request/second queue and a descriptive User-Agent.
3. Geocode on address save — **never block saving a project because geocoding failed**; allow dropping a pin by hand on the project screen. New-construction addresses are often missing from OpenStreetMap.
4. Dispatch gains the map pane: pins colored by task type, urgent red ring, tap → visit card → assign / reschedule / open.

### G2 — PWA & push
1. Manifest + lettermark icons; installable; app name from the company record.
2. Service worker for **push only** (no offline caching).
3. **[SONNET]** `web-push` with VAPID keys (owner generates via a given command; values go in `.env.local` and Cloudflare secrets); wire pushes for gate flips and urgent tickets; per-user toggle in Settings. **Verify under `npm run preview` first. If `web-push` fails in the Workers runtime, do not force it — raise DECISION NEEDED; the fallback is signing the notification request with the built-in crypto tools, no new dependency.**

### G3 — Hardening **[SONNET]**
1. Full `check:rls` (database + storage routes), `check:guard`, `check:size`. Report, then fix — never silently.
2. Mobile pass: every `/m` screen + `/service` at 390 px; a click-through checklist for the owner.
3. Sweep: no file >200 lines, no TODO or dead code, header comments everywhere, README current.
4. Empty states wherever data can be empty; every `OBSERVED` item resolved or moved to the parking lot with the owner's OK.
5. `scripts/backup` + npm `backup`: dated **database dump + R2 files sync**; README note: run weekly, copy to network storage. Then the one-time **restore test**: restore into a throwaway Neon project, confirm tables and row counts match, delete it, put the recipe in the README.
6. Decide with the owner whether to lift Cloudflare Access from `/m` — his call: it costs one extra login and buys a second wall.
7. Tag `v0.1-management`; final BUILD-LOG entry.

**FINAL GATE — live click-through:** quick-create ≤30 s with ≤3 inputs · the gate flips itself and rings once, including on a mirror job with no hardware · the service form creates a correctly linked ticket · isolation tests green · Today answers "what needs me now" at a glance · six real users exist with the right access · nothing requires a third employee to operate.

Output: `MANAGEMENT PORTAL v0.1 COMPLETE. Next: request the FIELD PORTAL ledger. It starts on SONNET (role scoping + sign-off capture).`

---

## Roadmap — the ledgers after this one

1. **Field portal** — crew Today, job screen with access info, complete flow + **homeowner sign-off with signature**.
2. **Automation** — office@ / service@ ingestion, PDF extraction, procurement auto-advance, drafted gate messages, exceptions, 7 a.m. digest, Telegram assistant (needs a speech-to-text service — not yet in the cost ledger), Quote Builder (contractor-side link pending D5).
3. **Money** — QuickBooks connect, one-tap invoicing, on-demand customer billing, deposits, change orders, payment sync, margins, customer SMS.
4. **Phone** — Twilio number, voice agent, WhatsApp channel, CRL Bridge Level 1 (after the ToS check), autonomy promotions, the four reports.
5. **Contractor portal** — customer login on the Phase A foundation.
