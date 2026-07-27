# Glaze Board — Decisions, Risks, Open Items, Parking Lot

**Why the system is this way.** This file exists so a future build session never quietly undoes something deliberate, and so the owner can challenge any decision with its reasoning in front of him. Every entry is open to discussion. Format: **decision · why · what would change it.**

---

# PART 1 — Decisions (DEC-1 … DEC-20)

**DEC-1 — Human first, AI assists.** The app is 100% operable by hand; every agent action has a button equivalent; no workflow requires AI to be up. *Why:* an outage or a bad parse must never stop the shop. *Change:* nothing removes the manual path; per-action autonomy toggles are the only way AI gains ground, flipped only by the owner.

**DEC-2 — Voice lives in the messenger, not the app.** Commands by voice/text to a bot — Telegram first, WhatsApp second. *Why:* you talk where you already talk; Telegram's bot platform is free, instant, has inline confirm buttons, and hands us voice files cleanly. WhatsApp is second because of per-message costs and template approval. Guardrails: whitelisted chats bound to named users, confirm-before-write, money and destructive operations app-only. *Change:* if you live in WhatsApp, the order flips — same interpreter either way.

**DEC-3 — One building, locked apartments (tenancy).** One Postgres database; every row stamped `company_id`; isolation enforced by Row-Level Security in the database; sessions carry company + role; every index starts with `company_id`. *Why:* a database per customer multiplies every migration, backup, monitor, and fix by the customer count — unbearable for a one-person operation. RLS means even buggy app code *cannot* read across companies. *Change:* a customer contractually requiring physical separation gets split out alone, later.

**DEC-4 — One codebase, three portals.** /m, /f, /c as route areas sharing the API, auth, and types. *Why:* management ships now, field stays small, contractor arrives later with zero rework; one deployable is one thing to babysit. *Change:* if portal needs diverge massively, the internal API is the clean cut line.

**DEC-5 — The role ladder.** Platform admin (software owner, cross-company, logged) → company admin (everything incl. users/settings) → manager (daily operations) → field (own assignments, access info, sign-off) → contractor (reserved). *Why:* the smallest matrix that's real. No approval hierarchies, no permission screens.

**DEC-6 — The site address is sacred; contacts are roles.** Site address always required, always its own field, never inherited from the customer's office address — even when a GC remodels his own home. Contacts attach as roles (GC contact, homeowner, tenant, property manager), zero-to-many; new construction may have none. Lockbox code + access notes ride the project and surface in the field portal. *Why:* reality includes landlords, tenants, and empty houses; the address is the one constant on every job — and the key that matches a service call to its project years later.

**DEC-7 — The sign-off is a document.** Install completion captures homeowner name + finger-drawn signature + timestamp on the installer's phone. Skipping requires a one-line logged reason. *Why:* disputes end where evidence begins, and the feed should tell the whole story including how the job closed.

**DEC-8 — We are the subcontractor; they are Customers.** The UI says Customers, never "subs." *Why:* language shapes software; mislabel the relationship and you build the wrong features. Hence two management wings: Operations and Customers & Sales.

**DEC-9 — The quoting split.** CRL Showers Online keeps doing design math and pricing; our **Quote Builder** produces the customer-facing document — our branding, three parties, share link with view tracking. *Why:* the customer-facing document is our face and our data; the design engine needn't be. **Parked:** the contractor-side quote link (open item D5) — a disabled placeholder until defined; building on a guess wastes the build.

**DEC-10 — Standing rules (so nobody "fixes" them).** Customer billing is generated on demand, never automatically. Purchase orders are prepared by the system, never sent by it. One approval covers everything (the split is a later toggle). Nothing customer-facing sends without a human tap. Ordering and payment are always human acts.

**DEC-11 — One color, one meaning.** Measure `#2563EB` · install `#16A34A` · service `#EA580C` · urgent red ring — identical on cards, calendar lanes, and map pins. *Why:* dispatching at a glance only works if a color never changes meaning between screens.

**DEC-12 — Map-driven dispatch.** Addresses geocode on save; visits render as colored pins; assignment happens from the pin. *Why:* routing is spatial — a list hides drive time a map shows instantly.

**DEC-13 — No dates in the plan.** The build plan orders work; it never promises durations. *Why:* predictions rot, sequence doesn't. (The 2-business-day, 7-day, and +7-day timers in the product are *business rules*, not schedule promises.)

**DEC-14 — Foundation ≠ empire.** "Commercial foundation" means exactly: company scoping, RLS, roles, portal routing, and no single-company assumptions in code. It does **not** yet mean contractor-portal screens, per-company theming, subscription billing, or a marketing site. *Why:* foundations are cheap early and brutal late; superstructure is the opposite.

**DEC-15 — PWA now, native later.** Installable web app on every phone; everything runs through one internal API so a future native field app reuses it all. *Change:* the crew genuinely needing offline mode or deeper camera control.

**DEC-16 — Maps start free, upgrade behind an adapter.** Leaflet + OpenStreetMap + Nominatim, $0, usage policy respected by design; all map code behind one adapter with an empty Google slot beside it. *Why:* free until a paid tool earns its keep; the later swap is one file and one key. *Change:* geocoding accuracy problems on real job addresses, or outgrowing fair use. **Middle rung before paying:** OpenStreetMap's coverage of brand-new construction addresses is patchy — and new construction is part of this business — so geocoding never blocks saving a project, a pin can be dropped by hand, and the free US Census geocoder is the next thing to try before Google.

**DEC-17 — Two-model build: cheap hands, strong foundations.** Composer by default; **[SONNET]** required for database schema, isolation, auth, the status machine, the gate, storage access, public-form security, deploys, and hardening — with protected files the cheap model may not touch and a forced switch announcement. *Why:* assembly work is pattern-following (cheap models do it well); foundation mistakes are quiet and expensive (they don't). With all of Phase A tagged, the honest figure is **roughly a third of steps on Sonnet**. *Change:* a step failing twice on Composer is automatically promoted to Sonnet.

**DEC-18 — The build is traceable because the executor doesn't reason.** One step per prompt · a numbered BUILD-LOG entry after every step (what, files, doc sections followed, model, checks) · a hard `DECISION NEEDED` halt on any gap · two failed attempts → written failure report and stop · a commit after every green step so "revert to the last commit" is always a clean undo. *Why:* the executing model is good at typing and bad at judgment, and the owner is not a developer — so judgment lives in the docs, memory lives in the log, safety lives in the save points.

**DEC-19 — Environments: workbench and live, and backups we own.** The database is cloud-hosted from day one; at go-live it splits into workbench (laptop's keys, forever) and live (only the deployed app's secrets). Backups: GitHub for code at every green step; `npm run backup` for database **plus files**, weekly to network storage, restore-tested once. *Why:* safety a non-developer can operate — two sets of keys and one weekly habit.

**DEC-20 — Hosting: the Cloudflare stack, chosen on trust.** Cloudflare (Workers via the OpenNext adapter, R2, Cron, Turnstile) + Neon (Postgres) + Better Auth (login inside our own app) + Resend (auth email) + GitHub. Chosen over the smoother Supabase + Vercel road after open discussion: the owner's trust criterion (pure-infrastructure companies), roughly a third of the running cost, deeper ownership. *Costs accepted knowingly:* a bumpier build (Sonnet share rises to ~a quarter or third of steps), one translation layer (OpenNext, officially supported by Cloudflare), and a tune-up duty (event-based, never calendar-based — DEC-13) because parts we own, we update. *Idea-safety calibration, recorded so it isn't re-litigated:* infrastructure providers monetize subscriptions, not customers' ideas; the code was already on GitHub; the moat is execution, glass-specific depth, and contractor relationships. *Vendor firewall:* outside services touched only through our own `src/lib` modules. We rent, never self-host, because self-hosting trades a shallow escapable dependence for a deep operational one. *Change:* repeated adapter stalls before Phase A completes → reverting is contained; after Phase A, we push through. Post-launch, a "moving day" ledger to one rented server remains available on request.

**DEC-21 — The database refuses even to its owner.**
Every business table gets `ENABLE` **and** `FORCE ROW LEVEL SECURITY`; the running app connects with a limited account (`glaze_app`) that owns nothing, while migrations use the owner account. *Why:* Postgres exempts a table's owner from that table's own security policies — so the isolation wall could be silently absent while appearing perfectly present. `check:rls` additionally asserts the app account owns no tables. *What would change it:* nothing — this is the wall DEC-3 depends on.

**DEC-22 — One database door, one driver, one transaction.**
All traffic uses the Neon driver's pooled connection; `withUser` opens a transaction, stamps company and role with a request-scoped setting, runs the query, commits. `SET` without `LOCAL` and `set_config(..., false)` are forbidden. *Why:* the single-shot connection mode cannot hold a stamp and a query together — the result is either everything empty (loud) or the stamp leaking onto the next person's request (silent, and it is exactly the cross-company leak all of this exists to prevent). *What would change it:* a faster connection route may be swapped in later behind the same door, per the vendor-firewall rule.

**DEC-23 — The login library owns the users table; its own tables sit outside the wall.**
Better Auth's `user` table *is* our users table, extended with our fields — never a second one. Its four tables are read through one named function (`readAuth`) and are not company-filtered. *Why:* a session must be read before the company is known, so filtering the session table by company makes login impossible — a real deadlock, and one an agent would "fix" by quietly disabling the protection. Every business table stays filtered. *What would change it:* nothing while login lives in our own code.

**DEC-24 — Ship at the end of Phase A, live at the end of Phase B.**
The live database and the deployed site are created when the foundation passes, not at the end of the ledger; Phase B's finish is the real launch, and C–G improve a running system. *Why:* sixty steps before first use is how solo builds stall, and deploy problems are far cheaper to find against four screens than forty. Cloudflare Access sits in front of the site until the public form arrives in Phase F. The workbench/live split of DEC-19 is unchanged — only its timing moves. *What would change it:* nothing; this only reduces risk.

**DEC-25 — Migrations go forward; the workbench resets.**
An applied migration is never rewritten. The undo during the build is `npm run db:reset`, which rebuilds the workbench from every migration plus seed data. *Why:* "revert to the last commit" undoes code, never a change already made to a database — a gap between the owner's mental model and reality. Test data is disposable; that is what the workbench is for. *What would change it:* nothing after go-live, when the live database only ever changes forward.

**DEC-26 — Standing orders load by rule file and by name.**
The standing orders live at `.cursor/rules/00-standing-orders.mdc` with always-apply set, **and** every prompt names the file explicitly. *Why:* the old `.cursorrules` format is deprecated and reportedly skipped in some modes, and the entire safety model — no decisions, protected files, model gates — depends on those rules being loaded every turn. Naming it in the prompt makes the safety net independent of the editor's behaviour. *What would change it:* a change in the editor's rule format; the content stays the source of truth either way.

**DEC-27 — Credentials never enter the agent's context.**
The agent never opens `userconfig.md` (the owner's private note), never asks for a value, and creates `.env.local` with names and blanks for the owner to fill. `.cursorignore` excludes `.env*`, `userconfig.md`, and `docs/archive/`. *Why:* everything the agent opens leaves the machine, which would contradict both the stated key rule and the trust criterion behind DEC-20 — and `.cursorignore` enforces context discipline mechanically instead of by asking politely. *What would change it:* nothing.

**DEC-28 — A track can be Not Needed, and the gate never fires on nothing.**
Glass and hardware each gain a `not_needed` state; the gate requires both tracks satisfied **and** at least one actually Received; projects carry a `job_type`. *Why:* mirror, partition and railing jobs legitimately have no hardware order, and a job waiting forever on an order that was never coming is the precise failure this system exists to prevent; the "at least one Received" clause stops an empty project leaping forward. *What would change it:* nothing.

**DEC-29 — Visits are the only record of who is on a job.**
`projects.assigned_installers` is removed. *Why:* two answers to one question is how a field worker ends up seeing a job that isn't theirs — and the field portal's security reads this answer. *What would change it:* nothing.

**DEC-30 — Money in cents, time with a zone.**
Amounts are whole cents in integer columns; every timestamp carries a time zone; each company has one. *Why:* decimal arithmetic drifts by pennies and then by dollars, and "two business days" is meaningless without knowing whose Tuesday. *What would change it:* nothing.

**DEC-31 — Rules the computer can check, it checks.**
`check:rls`, `check:guard`, `check:size` and `check:addr` run in the after-every-step ritual. *Why:* an instruction a model must remember is weaker than a script that fails. These four are the exception to "no testing framework" — plain scripts, no framework, guarding only the things that break silently. *What would change it:* nothing; new invariants get new scripts.

**DEC-32 — Five lanes, not eleven columns.**
The pipeline board groups the eleven statuses into Sales · Ordering · Ready & Scheduled · Installed · Billing; the card shows its exact status. *Why:* eleven columns cannot be read on a phone, and the information was already on the card. *What would change it:* a week of use disliking it — the eleven-column version is a one-line change.

---

# PART 2 — Confirmed Assumptions

Empty customer list at start · approval is one tap, note always optional, may arrive by voice or text · **one combined approval** in v1 · QuickBooks Online assumed (auto-detected at connect) · monthly billing for a few customers, marked on their card · **billing on demand only** · deposits optional, any % to 100, 50% pre-filled for direct homeowners · service phone number and forwarding decided later · **voice agent deferred; public service form live day one**, matching by address first · warranty ≤1 yr rule of thumb, human confirms · two mailboxes (office@, service@), system reads and files, sends nothing outbound without a human · **ordering human-only**; the system prepares the PO number and copyable block · one fabricator now (supplier is a field; parsers are per-supplier) · **6 users**: 2 office, 4 field, two of whom form Team 1 (assignable as a unit or individually) · internal calendar is truth, invites email to each assignee · AI-powered but human-controlled · voice via messenger, not in-app · auth ladder per DEC-5 · sign-off captured on the installer's phone · contact roles + sacred site address + lockbox codes · customer SMS is first-class · our own Quote Builder · multi-tenant foundation from migration one · two management wings · dispatch map · fixed color language · no dates on tasks · free tiers first · two-model build · traceable build.

---

# PART 3 — Open Items

| # | Item | Waiting on |
|---|---|---|
| D1 | QuickBooks Online vs Desktop | auto-detected at the connect step |
| D2 | Service phone number + forwarding rules | owner, before the phone ledger |
| D3 | Name for the service mailbox | owner, before the automation ledger |
| D4 | CRL's stance on automated browsing | check before Bridge Level 1 |
| **D5** | **Contractor-side quote link** — "quote the customers from the contractor's own quote page directly from our link" | **owner's explanation; gates half the Quote Builder** |
| — | Team 1 member names · company logo · Telegram binding | owner, when those phases land |

---

# PART 4 — Risk Register

| # | Risk | Mitigation |
|---|---|---|
| R1 | Email parsing updates the wrong project | Two-key rule (doc-type AND match ≥0.9) or it goes to the Review Queue; feed entries name the evidence; Reassign reverses cleanly |
| R2 | A spoken command hits the wrong record | Never guess: candidate buttons when scores are close; confirm-before-write; Undo on every feed entry; corrections logged |
| R3 | A human forgets the PO number when ordering | It's baked into the copyable block; fallback matching + Review Queue catch the rest; the digest flags "PO prepared but nothing sent" |
| R4 | Gmail push silently stops | Daily watch renewal + polling fallback + an alert if a mailbox goes unusually quiet |
| R5 | QuickBooks turns out to be Desktop | Connect step auto-detects and explains before anything syncs; money works manually until then |
| R6 | CRL changes their site → Bridge L1 breaks | Bridge is isolated, optional, screenshot-checkpointed; failure degrades to Level 0, which is sufficient forever |
| R7 | CRL's terms forbid automated access | Explicit check before L1 is enabled; L0 automates nothing on their site |
| R8 | Duplicate tickets from one leak on three channels | Dedupe by phone or normalized address within 48 h; merged, second source noted |
| R9 | Crew edits or declines calendar invites | The system is the source of truth; Today is the real assignment; invites are a convenience mirror |
| R10 | Future sessions bloat the code | Standing orders in the always-applied rules file; small single-purpose files; the sibling-pattern rule; the parking lot as a pressure valve; no half-built features |
| R11 | Voice agent mishears an address at 7 p.m. | In-call read-back; SMS confirmation invites correction; the morning digest surfaces every new ticket |
| R12 | An AI draft sounds wrong | Propose-only tier: nothing customer-facing sends without a tap; inline editing; autonomy promoted per-action, by the owner |
| R13 | Breakage at install / wrong glass delivered | Remake flow (child order, own PO, no project regression); "awaiting remake" chip keeps it visible |
| R14 | A revised promised date slips past a booked install | Revision parsing updates the date, the feed notes the change, and an install conflict fires an immediate flag |
| R15 | Cross-company leak once a second company exists | Isolation enforced by the database, not app code; an automated cross-tenant test runs in the checks; platform-admin access logged |
| R16 | Someone messages the bot and moves data | Only whitelisted chats bound to named users; confirm-before-write; money/destructive operations app-only; unknown chats ignored and logged |
| R17 | SaaS superstructure creeps into v1 | The DEC-14 fence: foundation only until the contractor-portal ledger |
| R18 | The OpenNext layer hits an edge case at deploy | Deploy steps are [SONNET]-tagged; `npm run preview` runs the true Workers runtime before every deploy; fallback recorded in DEC-20 |
| R19 | Owning the login code means owning its updates | Better Auth is mainstream and maintained; the event-based tune-up applies updates; auth files are protected |
| R20 | Neon's free tier naps between uses | First query wakes it in about one to two seconds; the live database moves to pay-as-you-go, which never naps |
| R21 | The app outgrows Cloudflare's free 3 MB Worker limit | `check:size` reports the compressed size from Phase A onward; over 2.5 MB is noted early; the $5/month plan (10 MB) is likely rather than hypothetical and doesn't change the $5–15 total |
| R22 | Neon's free compute-hours run out and suspend the database mid-build | Screen polling is 30 s, visible-tab only, and stops after ten minutes idle; the live project moves to pay-as-you-go at go-live |
| R23 | Push notifications may not run in the Workers runtime | Verified under `npm run preview` before deploying; on failure the step raises DECISION NEEDED rather than forcing it — the fallback signs the request with built-in crypto tools, no new dependency |
| R24 | Resend won't send invites until the domain is verified | Domain verification is an owner task before Phase B (DNS records go in Cloudflare, where the domain already lives) |

---

# PART 5 — Parking Lot (good ideas, not in v1)

Split design/cost approvals (schema ready — a toggle) · system-sent purchase orders (the prepare flow already generates everything) · automatic monthly billing (explicitly rejected; the on-demand flow would become a scheduled job with review) · native mobile app for field workers (the API makes it a reuse, not a rewrite) · full voice-agent autonomy and daytime answering · a second glass fabricator · CRL Bridge Levels 1–2 · contractor read-only status link (a share-token seam exists) · contractor approval replies parsed from email · Spanish-language voice agent · review-request message after Paid · common-hardware mini stock list (inventory is a rabbit hole) · cycle-time trend charts (v1 shows only the four numbers that matter: jobs by status, cycle time, unpaid by customer, per-job margin) · per-company branding and platform subscription billing (until a second company exists) · e-signature approval on quotes · Google Maps swap-in (adapter and empty slot already exist) · self-hosted git for full trust consistency.
