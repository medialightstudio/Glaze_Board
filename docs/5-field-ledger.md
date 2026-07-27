# Field Portal Ledger

Build after Management v0.1. Starts with role scoping + sign-off. Product: `docs/1-product.md` Field portal. DEC-29: visits are the only assignment record.

## F1 — Field Today

1. `/f` lists today's visits where the signed-in user is in `assignees` (or team membership). Office roles see all company visits for oversight.
2. Cards: task color (measure/install/service), address, one-tap navigate (maps link), open job.
3. Empty: "No jobs today."

**Verify:** book a visit assigned to a field user; it appears on `/f`.

## F2 — Job screen

1. `/f/jobs/[visitId]`: project title, status, site address + navigate, access row (lockbox + notes), documents (drawings/photos), notes from project, complete CTA when type is install/measure/service.
2. Field never links to `/m`. Office may use "Back to office".

**Verify:** open job; access info and docs visible; no management nav.

## F3 — Complete + homeowner sign-off

1. Complete flow: upload/capture photos → optional punch-list lines → homeowner name + finger-drawn signature (stored as document + `signer_name`/`signed_at`) → mark visit complete; install visits transition project toward Installed via status-machine when appropriate.
2. Skip sign-off requires a logged reason (`skip_reason` on signature document or visit).
3. Feed entry: "Completed via Field" with evidence.

**Verify:** complete with signature; skip with reason; both appear on project feed.

Output: `FIELD PORTAL v0.2 COMPLETE. Next: Automation ledger.`
