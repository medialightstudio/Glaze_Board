# Glaze Board — Build Ledger: Automation

After Field. Systems Parts 1–2. DEC-1, DEC-2, DEC-9, DEC-10. Autonomy toggles default **off**.

**Step-size rule:** verify ≤5 clicks; ≤5 files; one sentence without "and."

---

### H1 — Automation schema [SONNET]
1. Ensure migrations cover `ai_runs`, `command_log`, `mail_*`, `review_queue_items`, `autonomy_settings`, `quotes`/`quote_lines`/`quote_views`, `message_drafts`, `messenger_bindings`, `exceptions` (0016) with FORCE RLS.
**Verify:** `npm run migrate`; `check:rls` green.

### H2 — AI door
1. `src/lib/ai/` single LLM door; every call logs `ai_runs`.
2. Heuristic fallback only when no `LLM_API_KEY` — never claim COMPLETE without logging.
**Verify:** one extract call writes `ai_runs`.

### H3 — PDF text + vision fallback
1. Text-layer extract in `src/lib/pdf/extract.ts`.
2. If text thin and LLM key set, vision/JSON extract; else low confidence → Review Queue.
**Verify:** sample PDF yields text or review row.

### H4 — Extract on upload
1. Document upload runs extract; &lt;0.9 → Review Queue with alternatives when possible.
**Verify:** drop low-conf PDF → Review badge increments.

### H5 — Gmail OAuth
1. Connect office@ / service@; store **real** email address + tokens.
**Verify:** Settings shows Connected with real address (needs Google client — else DECISION NEEDED).

### H6 — Poll + message-id dedupe
1. Cron/poll lists recent mail; unique `(company_id, message_id)`.
**Verify:** second poll adds zero duplicate `mail_messages`.

### H7 — Attachment fetch → R2
1. `gmail.getAttachment`; PDF/images → documents + R2 via `filePdfBytes`/upload path.
2. Stop extracting from subject alone when attachments exist.
**Verify:** supplier PDF lands in R2 and `documents`.

### H8 — PO match helper
1. Match: PO primary; else supplier order #; else fuzzy project; return score + top-3.
**Verify:** known PO matches glass order ≥0.9.

### H9 — Procurement auto-advance
1. Auto-do only if doc-type ≥0.9 AND match ≥0.9 AND autonomy toggle on; advance glass/hardware; feed evidence.
2. Else Review Queue; nothing silent.
**Verify:** toggle off → queue; toggle on + high conf → status advances.

### H10 — service@ → tickets
1. Service mailbox creates ticket; body/subject → matching.ts; attach photos if present.
**Verify:** service email creates linked or no_match ticket.

### H11 — Watch / label
1. Gmail watch+history when configured; label "Filed by system"; else OBSERVED poll-only.
**Verify:** processed message labeled or OBSERVED noted.

### H12 — Review Queue UI
1. Split pane: document/PDF left; guess, confidence, top-3 right; Confirm / Reassign / Ignore.
**Verify:** open item shows PDF + three candidates when present.

### H13 — Confirm / Reassign reverse
1. Confirm attaches + advances; Reassign moves doc and reverses prior advance (logged); Ignore closes.
2. Correction → training signal (`ai_runs` or `command_log`).
**Verify:** Confirm advances; Reassign undoes.

### H14 — Exceptions (business days)
1. Ack &gt;2 business days; promised passed; quote ≥7d; will-call &gt;3d; unbilled monthly reminder only — company TZ.
**Verify:** seed overdue ack → exception row.

### H15 — 7 a.m. digest
1. Cron builds digest; push + Resend email to office; company TZ window.
2. Wire Cloudflare `scheduled` → `/api/cron` (or documented equivalent) with `CRON_SECRET`.
**Verify:** `?job=digest` sends; scheduled handler exists in worker config/docs.

### H16 — Create propose-only drafts
1. Insert `message_drafts` on gate flip, quote aging, post-install +48h.
**Verify:** gate flip creates draft row.

### H17 — Draft real Send
1. Send button delivers via Resend and/or Twilio; not status-only.
2. UI on Today and/or project.
**Verify:** tap Send → outbound attempt logged + status `sent`.

### H18 — Autonomy wired
1. Every auto-do path reads `autonomy_settings.toggles` (default off).
**Verify:** toggle gates H9 advance.

### H19 — Quote Builder + CRL L0 + PDF→BOM
1. Quotes CRUD, PDF generate, share view-track; Send human-tapped (draft/Resend).
2. Contractor link disabled (D5).
3. Send-to-CRL panel; CRL PDF extract fills quote #, lines, hardware BOM, price.
**Verify:** drop CRL-like PDF → quote lines + BOM; share link tracks view.

### H20 — Telegram full intents
1. Bind code; unknown chats ignored + security-logged.
2. STT; intent schema; confirm → same APIs as UI (create_project, book_visit, update_status, note, ticket).
3. Money/destructive → deep link to specific `/m/...` screen.
**Verify:** confirm Create project creates a project; invoice intent deep-links.

**FINAL GATE — Automation:** attachment filing · match/advance · Review reverse · drafts send · Quote/CRL fill · Telegram writes.
Output: `AUTOMATION v0.3 COMPLETE. Next: Money ledger.`
