# Glaze Board — Build Ledger: Field Portal

Execute in order under the standing orders. Product: `docs/1-product.md` Field portal. DEC-29: visits are the only assignment record. Office may open `/f`; field never opens `/m`.

**Step-size rule:** verify ≤5 clicks; ≤5 files; one sentence without "and."

---

### F1 — Role scoping [SONNET-adjacent]
1. Confirm `middleware` / `/m` layout already bounce field roles off `/m`.
2. `/f` layout: signed-in only; office sees "Back to office"; field never links to `/m`.
**Verify:** field test user cannot open `/m`; office can open `/f`.

### F2 — Field Today (assignees + team, company TZ)
1. `/f` lists visits for company-local today where user is in `assignees` **or** in `teams.member_ids` for `visits.team_id`.
2. Office roles see all company visits for oversight.
3. Cards: DEC-11 task color, address, Navigate, Open. Empty: "No jobs today."
**Verify:** book a visit with Team 1; both members see it on `/f`.

### F3 — Job screen
1. `/f/jobs/[visitId]`: title, status, address+navigate, access (single lockbox source), notes, documents list with image preview links, Complete CTA.
2. Reject open/complete if field user is not assignee/team (office exempt).
**Verify:** open assigned job; unassigned field user gets refused.

### F4 — Photo capture on complete
1. Complete UI: multi photo upload (camera/file) → `documents` type `photo`, source `field`.
2. Photos required for install complete (at least one) unless skip-signoff path still allows photos optional with punch.
**Verify:** complete install with two photos; both appear on project feed/docs.

### F5 — Punch list + complete CTA by type
1. Optional punch-list lines stored on `visits.punch_list`.
2. Complete CTA for measure / install / service visit types.
**Verify:** punch lines persist after complete.

### F6 — Signature / skip
1. Homeowner name + finger signature; reject blank canvas (ink detection).
2. Doc type **`signoff`** with `signer_name` / `signed_at`; skip requires `skip_reason`.
**Verify:** signature path and skip+reason path both store evidence.

### F7 — Status transitions via status-machine
1. Install complete from `install_scheduled` → `installed`.
2. Measure complete from `measure_scheduled` → `measured`.
**Verify:** illegal jumps refused; legal ones land on project status.

### F8 — Feed + hardening
1. Feed entry: "Completed via Field" with evidence doc ids.
2. Unify `access_lockbox_code` / `lockbox_code` (read/write one column; migrate copy).
3. Phone click-through at 390px.
**Verify:** feed shows completion; lockbox shows on field + office project screen.

**FINAL GATE — Field:** assignee isolation · photos · signature/skip · measure+install transitions · no `/m` for field.
Output: `FIELD PORTAL v0.2 COMPLETE. Next: Automation ledger.`
