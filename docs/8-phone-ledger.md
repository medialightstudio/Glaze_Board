# Phone Ledger + CRL Bridge

After Money. D2 (number) before J1. D4 (CRL ToS) before L1 live.

## J1 — Voice agent

Twilio + ElevenLabs; after-hours/overflow; mid-call ticket; SMS confirm (48h dedupe).

## J2 — WhatsApp

Same interpreter as Telegram via Twilio.

## J3 — CRL Bridge L1/L2

Isolated `bridge/` worker; `bridge_jobs` queue; L0 always; L1 after D4; L2 cart stop before checkout.

## J4 — Autonomy + four reports

Settings promotions; jobs by status, cycle time, unpaid by customer, per-job margin.

Output: `PHONE v0.5 COMPLETE. Next: Contractor portal (later).`
