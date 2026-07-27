# Glaze Board — Systems: Agents, Integrations, Hosting

Consult when a build step names it. Most of this arrives in later ledgers; the management portal needs only Part 3.

---

# PART 1 — AI Agents

One "office manager" persona, five capabilities. Every LLM call goes through one internal `ai` module and lands in `ai_runs`. **Ground rule: every agent action has a manual equivalent in the app — if all AI is down, the shop still runs.**

**Autonomy tiers.** *Auto-do:* filing documents, advancing procurement sub-statuses on high-confidence parses, matching tickets to projects, logging, computing exceptions, building the digest. *Propose-only (human taps Send/Confirm):* any customer-facing message, warranty-vs-billable classification, anything touching money or ordering, low-confidence matches, every assistant **write**. Per-action promotion toggles exist in Settings from day one, all off.

## 1.1 Messaging Assistant (Telegram first, WhatsApp later)

Run the system from where you already talk. Trigger: a message from a **whitelisted chat** bound to a named user (one-time code from Settings); unknown chats ignored and security-logged. Pipeline: voice message → transcription → intent + entity extraction → record matching (address_norm > phone > name > fuzzy title) → **confirmation via inline buttons** → execution through the same internal API the app's buttons use → feed entry ("You, via Telegram: …") + `command_log`.

> You: *"New project for Riverside Remodels, forty-two Oak Street, master bath"*
> Bot: "Create project: **Riverside Remodels — 42 Oak St**?" `[✅ Create] [✏️ Edit] [✖ Cancel]`

```json
{ "intent": "create_project | open | update_status | record_approval | glass_update |
             hardware_update | add_note | create_ticket | book_visit | query",
  "entities": { "account":"", "address":"", "project_hint":"", "status":"",
                "datetime":"", "assignees":[], "note":"", "phone":"" },
  "matches": [ { "project_id":"", "label":"", "score":0.0 } ], "confidence": 0.0 }
```
Reads answer instantly. Writes always confirm. Notes execute with an Undo button. Match <0.85, or two candidates within 0.1 → show candidate buttons, never guess. **Money and destructive operations are app-only** — the bot replies with a deep link instead of acting.

## 1.2 Email Ingestion Agent

office@ → supplier documents filed and statuses advanced; service@ → tickets. Gmail push per mailbox, 10-minute polling fallback. Filter (glassfab/crlaurence domains + a generic net for order-looking PDFs) → attachment → text extraction (OCR fallback) → LLM extraction:
```json
{ "doc_type": "acknowledgment | packing_slip | delivery_confirmation |
               order_confirmation | invoice | other",
  "supplier":"", "order_number":"", "our_po_number":"", "line_items":[],
  "promised_date":"", "ship_date":"", "total":0, "confidence":0.0 }
```
Match: **PO number** primary; fallbacks: known supplier order number, fuzzy name/address, glass sizes. **Auto-do** only when doc-type ≥0.9 AND match ≥0.9 — attach, advance, feed entry with evidence, notify only if it flips the gate or raises an exception. **Anything less → Review Queue; nothing changes silently.**

*Failure modes handled:* duplicate emails (message-id dedupe — attach once, never re-advance) · one PDF spanning multiple POs (split; leftovers to Review Queue) · revised acknowledgments (update date, note the change, flag install conflicts) · wrong match found later (Reassign moves the doc and reverses the status change, both logged) · late email for a received order (attach only).

## 1.3 Office Agent

Triggers: 7 a.m. daily, plus events (gate flip, install done, quote aging). *Auto-do:* exceptions (ack >2 business days, promised date passed, quote ≥7 days, will-call sitting >3 days, unbilled monthly customers as a **reminder line only**) and the digest ("2 installs today · Glassfab promised the Nguyen glass tomorrow · Johnson quote is 9 days old — follow-up drafted"). *Propose-only:* scheduling message on gate flip · quote follow-ups · post-install care message (48 h after Installed) · SMS drafts. Every draft has a Send button and inline editing.

## 1.4 Voice Phone Agent (later ledger)

ElevenLabs + Twilio on the owner's number; **after-hours and rings-out overflow only**. Greet → (caller-ID webhook may pre-load "Is this about the shower at 42 Oak St?") → collect name, callback number, service address, issue, urgency probe ("is water actively leaking?") → offer photos-by-text → **mid-call webhook creates the ticket before hang-up** → read-back → close.
```json
{ "name": "create_service_ticket",
  "input": { "contact_name":"", "phone":"", "address":"", "issue":"",
             "urgent": false, "source":"call" } }
```
Post-call webhook: transcript + analysis → office agent finishes (project match, warranty proposal, transcript + recording attached, templated SMS confirmation — the one auto-send exception, 48 h dedupe). Escalation: asks for a human / upset / emergency → offer transfer, promise same-day callback, ticket URGENT + push. Wrong numbers and sales calls: polite exit, no ticket.

## 1.5 CRL Bridge (isolated, feature-flagged off)

**Level 0 (ships first, and is enough):** a "Send to CRL" panel formats measurement data for fast entry; the finished CRL quote PDF dropped on the project auto-fills quote number, price, and hardware bill of materials, feeding the Quote Builder. **Level 1 (later, only after the ToS check):** Playwright + AI-resilient targeting creates the shell and enters dimensions, then **pauses for the human** for all judgment; screenshot checkpoints; any failure degrades to Level 0; never a blocking dependency. **Level 2 (later):** builds the crlaurence.com cart from the bill of materials and **stops before checkout** — ordering and payment stay human, always.

---

# PART 2 — Integrations

**Gmail (two mailboxes).** office@ for supplier documents, service@ for intake. Watch + history (push) with polling fallback and daily watch renewal; attachments to storage; message-id dedupe; processed mail labeled "Filed by system." **Outbound rule:** nothing sends from these boxes except human-tapped drafts and crew calendar invites. **Supplier orders are never sent by the system.**

**PDF pipeline.** Text-layer extraction first, OCR fallback, one LLM extraction call into the strict schema above, stored on the document plus `ai_runs`. Serves Glassfab documents, CRL confirmations, CRL quote PDFs, and hand-dropped files.

**QuickBooks Online.** *Our system runs the job; QuickBooks keeps the books; nothing typed twice.* Guided one-time OAuth that auto-detects Online vs Desktop. Customers auto-match by name (create if missing, store the id); a project appears as a clearly named invoice line ("Smith residence — master bath frameless shower"). **Per-job invoice:** one tap → lines from the quote ± change orders, QuickBooks' own tax settings, sent via QuickBooks or its payment link. **Customer billing:** on demand only, from the Customer page or Billing page → review completed unbilled jobs → one tap creates **one consolidated invoice, one line per project** (one number to pay, one receivable, recognizable lines). **Deposits:** optional, any %, separate deposit invoice, shown as a credit line on the final. **Payments:** webhook + daily poll → project flips to Paid; unpaid-balance-by-customer always true.

**Google Calendar (via invites).** The internal calendar is the source of truth; assigning a visit emails a standard .ics invite to each assignee (teams expand to members); moves and cancels send updates automatically. Zero setup on anyone's phone.

**Messengers.** Telegram first: free Bot API, webhook updates, voice-file download, inline confirm buttons. Binding: Settings shows a 6-digit code → send it to the bot → that chat is bound to that user in that company. WhatsApp later via Twilio (per-message costs and template approval are why it's second).

**SMS with customers (Twilio).** Two-way texting threaded per project/ticket; outbound drafts propose-only except the templated ticket acknowledgment; inbound texts run the ticket pipeline; MMS photos attach.

**Maps.** All map code behind one adapter (`src/lib/maps/`). Active: **Leaflet + OpenStreetMap tiles + Nominatim geocoding — $0**, respecting their usage policy by design (1 request/second queue, descriptive User-Agent, attribution). Geocoding runs on address save; pins colored by the fixed task tokens. An empty Google implementation slot sits beside it — one file and one key, whenever it earns its cost.

**Notifications.** Web push (installable PWA) for gate flips, exceptions, urgent tickets; daily 7 a.m. digest as push + email; SMS-to-self once the Twilio number exists. Per-channel toggles in Settings.

---

# PART 3 — Hosting & Environments (needed now)

## The five components

| Component | While building | When live |
|---|---|---|
| **The app** | Your laptop; vaulted on GitHub | **Cloudflare Workers** |
| **The database** | **Neon cloud from day one** — never on your laptop | Neon (live project) |
| **Files** | **Cloudflare R2**, reached only through our app routes — the bucket is never public. One code path in development and production (the adapter's development binding), so the production path is exercised daily | Same |
| **Login** | **Our own code** (Better Auth); its `user` table *is* our users table, extended (DEC-23) | Same — no login vendor |
| **Background work** | Scheduled tasks inside the same app (Cloudflare Cron) | Same — no extra servers |

Plug-in services (Gmail, Telegram, Twilio, ElevenLabs, QuickBooks, Resend, and a speech-to-text service for the assistant's voice notes) are accounts you connect, not things we host. The only ever-separate deployable is the optional CRL Bridge, much later.

**There is no future day where the database "moves to a server."** It is born on one; while building, the local app already talks to the cloud database.

## Two databases (from go-live)

**Workbench** `glazeboard-dev` — test data; the laptop's keys point here forever. **Live** `glazeboard-live` — **created at the end of Phase A, not at the end of the build** (DEC-24); migrations run fresh, real company seeded; only the deployed app holds its secrets. Nothing built or broken locally can touch real business data.

**Undo, by kind:** code reverts with git ("revert to the last commit"). **Databases do not** — migrations only go forward, and the build-time undo is `npm run db:reset`, which rebuilds the workbench from every migration plus seed (DEC-25).

**Go-live is not a migration:** create the live database → connect the repo to Cloudflare (push-to-deploy) and paste the live secrets there → log in at the real URL. This happens at the **end of Phase A**, with **Cloudflare Access** (a free login wall) in front of everything until the public service form arrives in Phase F. From Phase B on, the shop runs on the live app and every later phase deploys the day it passes.

## Multi-company

Each new company is a **locked apartment in one building**: a row plus an admin invite, created in seconds; the database itself refuses cross-company reads. A customer contractually needing physical separation can be split out alone, later, without touching anyone else.

## Backups & exits

**Code:** GitHub vaults every green step; keep a copy of the repo folder on your network storage. **Data:** `npm run backup` produces a dated database dump **plus the R2 files** — weekly, to network storage, restore-tested once.

Two different safety nets, often confused: **Neon's own point-in-time restore is the seatbelt** (undo a bad afternoon, available once you're on the paid plan). **Your weekly dump is the exit door** — proof you can leave, and the thing that works if the vendor itself is the problem. Keep both.

**Exit doors:** the app is standard Next.js and runs on any Node host; scheduled tasks are plain URLs; files use the universal S3 standard; the data is plain Postgres and the isolation rules travel inside the dump; login is already ours. One rented server (~$6–10/mo, Docker or Coolify) could carry the whole system if you ever want that — a "moving day" ledger on request. **Two folders on your network storage — the code and the weekly backup — *are* the business's software.**
