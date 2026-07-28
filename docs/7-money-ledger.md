# Glaze Board — Build Ledger: Money

After Automation. DEC-10, DEC-30. QuickBooks Online assumed (D1). Billing never automatic.

**Step-size rule:** verify ≤5 clicks; ≤5 files; one sentence without "and."

---

### I1 — QB OAuth + token refresh
1. OAuth connect; store tokens; refresh helper before API calls.
**Verify:** Settings Connected (or DECISION NEEDED for QB secrets).

### I2 — Customer match → qb_customer_id
1. On connect or invoice: match/create QB customer by name; write `accounts.qb_customer_id`.
**Verify:** invoicing path has qb_customer_id without hand SQL.

### I3 — Per-job invoice
1. Project "Invoice this job" creates invoice from quote ± change orders; optional QB create; status → Invoiced via status-machine.
**Verify:** one tap from project creates invoice row.

### I4 — Consolidated customer billing
1. Billing page + customer page: toggle unbilled jobs → one invoice.
**Verify:** two installed jobs → one invoice, two lines.

### I5 — Deposits
1. UI: optional % (Direct homeowner 50% prefill); separate deposit invoice; credit on final.
**Verify:** deposit then final shows credit.

### I6 — Change orders
1. Project change-order add; included on next invoice lines.
**Verify:** CO appears on invoice total.

### I7 — Payment webhook + poll
1. `/api/webhooks/qb` + cron poll; reduce `balance_cents`; transition Paid when settled.
**Verify:** simulated payment clears balance / marks Paid.

### I8 — Margin writers
1. Glass ack price → `margin_glass_cents`; hardware cost → `margin_hardware_cents`; display margin = price − glass − hardware.
**Verify:** ack updates margin fields.

### I9 — SMS threads UI
1. Project/ticket SMS thread; list messages; compose draft.
**Verify:** thread visible on a ticket.

### I10 — Propose-only outbound SMS
1. Outbound goes through draft/confirm except templated ticket ack (48h dedupe).
**Verify:** office Send hits Twilio when configured.

### I11 — DEC-10 guards
1. No auto monthly billing job; no silent QB send without tap.
**Verify:** code paths require human POST.

### I12 — Money hardening
1. Extend `scripts/cf-secrets` for `QB_*`, `TWILIO_*`, etc.; RLS on money tables; Reports unpaid uses live balances.
**Verify:** `check:rls`; Billing unpaid matches invoices.

**FINAL GATE — Money:** QB customer match · per-job + consolidated · deposits/CO · payment sync · margins · SMS.
Output: `MONEY v0.4 COMPLETE. Next: Phone ledger.`
