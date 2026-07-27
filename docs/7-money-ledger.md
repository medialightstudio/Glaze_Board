# Money Ledger

After Automation. DEC-10, DEC-30. QuickBooks Online assumed (D1).

## I1 — QuickBooks connect

OAuth; store tokens; match/create customers → `qb_customer_id`.

## I2 — Invoicing

Per-job + consolidated customer billing; deposits; change orders; never automatic.

## I3 — Payments + margins

Webhook + daily poll → Paid; margin = price − glass − hardware.

## I4 — Customer SMS

Twilio threads; propose-only outbound except ticket ack template.

Output: `MONEY v0.4 COMPLETE. Next: Phone ledger.`
