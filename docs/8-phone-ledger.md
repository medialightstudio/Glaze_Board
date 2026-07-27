# Glaze Board — Build Ledger: Phone + CRL Bridge

After Money. **D2** before voice live. **D4** before Bridge L1 live.

**Step-size rule:** verify ≤5 clicks; ≤5 files; one sentence without "and."

---

### J1 — Twilio routing
1. Voice webhook after-hours/overflow; `DEFAULT_COMPANY_ID` or To→company map.
**Verify:** POST webhook returns TwiML (or DECISION NEEDED D2).

### J2 — Structured voice ticket
1. Gather name, callback, address, issue, urgency; mid-call ticket create; read-back.
**Verify:** speech creates ticket with address field when provided.

### J3 — Voice TTS
1. Twilio `<Say>` day-one; ElevenLabs if `ELEVENLABS_API_KEY` — else OBSERVED.
**Verify:** TwiML speaks greeting.

### J4 — Post-call finish
1. Transcript/recording on `call_logs`; match project; warranty proposal; attach evidence.
**Verify:** call_log row linked to ticket.

### J5 — SMS confirm 48h dedupe
1. Templated ticket ack SMS; `dedupeTicket` prevents double spam.
**Verify:** second call within 48h does not re-SMS.

### J6 — WhatsApp = Telegram interpreter
1. WhatsApp inbound uses same intent/confirm pipeline as Telegram (channel flag).
**Verify:** WhatsApp text creates confirmable command_log (when Twilio WA configured).

### J7 — Bridge job queue
1. `bridge_jobs` enqueue/claim/checkpoint/fail/done APIs with shared secret.
**Verify:** enqueue → claim returns job.

### J8 — L0 until D4
1. Project Send-to-CRL panel always; L1 button only if `crl_tos_accepted` && `crl_bridge_enabled`.
2. Settings admin toggles for ToS accept + enable.
**Verify:** L1 refused before ToS; L0 copy works.

### J9 — L1 worker pause/screenshots
1. `bridge/worker.mjs`: Playwright path when `BRIDGE_PLAYWRIGHT=1`; checkpoint screenshot keys to R2; else fail→L0 message.
**Verify:** without Playwright, fail closed; with flag, checkpoint status `paused`.

### J10 — L2 cart stop
1. Level 2 payload builds cart steps; stops before checkout; never pays.
**Verify:** L2 job completes or fails without checkout action.

### J11 — Autonomy promotions
1. Settings toggles consulted by mail/voice/bridge auto-do paths; money/order stays propose-only.
**Verify:** toggle change affects one auto-do path.

### J12 — Four reports verified
1. Jobs by status, cycle time, unpaid by customer, per-job margin — real invoice/margin data.
**Verify:** after a Paid job, unpaid drops; margin non-zero when costs set.

**FINAL GATE — Phone:** structured voice · SMS dedupe · WA interpreter · Bridge L0+gated L1 · reports.
Output: `PHONE v0.5 COMPLETE. Next: Contractor portal (later).`
