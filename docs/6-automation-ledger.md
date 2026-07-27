# Automation Ledger

After Field. Systems Parts 1–2. DEC-1, DEC-2, DEC-9, DEC-10.

## H1 — AI + PDF platform

`ai_runs`, extract on document upload, Review Queue row on low confidence. `src/lib/ai/` single door.

## H2 — Mail ingest

Gmail OAuth for office@ / service@; push + poll; message-id dedupe; office → docs/match; service → tickets.

## H3 — Review Queue UI

Split pane Confirm / Reassign / Ignore; procurement auto-advance at ≥0.9/≥0.9.

## H4 — Exceptions + digest + drafts

7 a.m. digest (push + email); exception rules; propose-only message drafts with Send.

## H5 — Quote Builder + CRL L0

Quotes CRUD, PDF generate, share link view-tracked, Send human-only; contractor link disabled; Send-to-CRL panel; CRL PDF → BOM/quote fill.

## H6 — Telegram assistant

Bind code, webhook, STT, intent schema, confirm-before-write, deep link for money/destructive.

Output: `AUTOMATION v0.3 COMPLETE. Next: Money ledger.`
