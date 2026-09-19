# Plan — Feature 5: Actions & Approvals API

**Status: largely shipped.** Revised against commit `7eb554c`. This is now a
delta — what landed, where it diverged from the original plan, and which of the
original concerns are still open.

## What shipped

| Planned | Actual |
| --- | --- |
| `POST /api/actions` with `{ alertId }` | `POST /api/alerts/:id/draft` — drafting *is* creation |
| `POST /api/actions/:id/draft` | folded into the above |
| `POST /api/actions/:id/approve` | ✅ as planned |
| `POST /api/actions/:id/dismiss` | ✅ as planned |
| `GET /api/actions` | ✅ newest-first |
| `PATCH /api/actions/:id` | not built — the edited text rides along in the approve body |
| `GET /api/actions/:id/events` | not built — no event log exists |

Three things the implementation got right that the plan did not anticipate:

- **A `Resolution` enum.** `delay_and_apologize`, `offer_refund`,
  `partial_shipment`, `cancel_and_refund`, `inventory_correction`. The founder
  picks the fix *before* drafting, and the choice drives the prompt. The original
  plan treated the resolution as implicit in the alert — this is better, and it
  is what makes `adjust_inventory` reachable.
- **Server-side prompt context.** `buildDraftContext()` in `ai.ts:88` composes
  customer, channel, items, promised ship date, the stock arithmetic, and the
  chosen resolution. The client no longer assembles prompts, exactly as planned.
- **Alert membership is validated.** `routes/alerts.ts` recomputes
  `currentAlerts()`, 404s an unknown alert id, and rejects an `orderKey` that is
  not in `relatedOrderKeys`. A client cannot fabricate a shortage — the core
  safety property the plan was built around.

`adjust_inventory` is fully wired: approving an `inventory_correction` adds
`Math.abs(available)` to `startingStock` and reports the change in
`inventoryEffect`. Note this is now the one write that mutates starting stock —
worth a line in the README, which currently presents it as untouched by the app.

---

## Still open

### 1. The alert snapshot is still not frozen  ← the plan's central concern

`ActionRecord` holds `alertId` and nothing else about the alert. The title,
explanation, and `calculation` that justified the decision are recomputed from
live data, and `GET /api/actions` returns no alert context at all.

So approval history cannot answer "what did the numbers look like when this was
approved?" — and `shortage:HOODIE-BLK-M` genuinely recurs, because the id is
derived from the SKU alone (`shared/src/alerts.ts:37`).

Fix: copy `alert_kind`, `alert_title`, `alert_explanation`, `alert_calculation`,
and `related_order_keys` onto the record at creation in
`routes/alerts.ts:80`. Cheap now, since creation already has the alert in hand.

### 2. Approval destroys the AI's original draft

`routes/actions.ts:58` — `if (parsed.data.draft) action.draft = parsed.data.draft;`
overwrites in place. The model's original text is gone, so the record cannot show
what the human changed.

Fix: keep `draft` as written by the model, add `finalDraft` for the approved text.
Two columns, as the plan called for.

### 3. No one-open-action-per-alert constraint — this is a live bug

`POST /api/alerts/:id/draft` persists a `pending_review` record on *every* call,
and the UI calls it every time. `Attention.tsx`'s **Re-draft** button clears
`pending` and routes back to "Draft the message", which issues a fresh POST — a
new row, with the previous one left behind as an orphan.

With `inventory_correction` that becomes a correctness failure, not just clutter:

1. Draft an `inventory_correction` for `shortage:X` → action A (`pending_review`)
2. Re-draft → action B (`pending_review`), A still live
3. Approve A → `startingStock += 6`, the shortage resolves, the alert disappears
4. Approve B → `startingStock += 6` **again**

Step 4 succeeds. `approve` only checks that *this* action is still pending; it
never re-checks that the alert still exists or that a sibling already resolved it.
Stock is silently corrected twice.

Fix, in order of directness:
- Re-validate at approval time that `alertId` is still in `currentAlerts()`
- Enforce one open action per `alertId`: reuse the existing row on re-draft, or
  supersede the old one
- Both, ideally — the first closes the stock bug, the second stops the history
  from filling with abandoned drafts

### 4. No audit log

No `action_events` table. Re-drafts, edits, and dismissal reasons leave no trace;
`decidedAt` plus the mutated `draft` is the entire record. Lower priority than
1–3 but it is what "immutable audit log" in the backlog asks for.

### 5. Persistence shape

The `actions` table is `id` + a JSON blob, like every other table
(`database.ts:35`). The partial unique index the plan specified
(`WHERE status = 'pending_review'`) is not expressible against a JSON column
without a generated column, so #3 has to be enforced in application code — or
the actions table gets promoted to real columns first.

---

## Revised next steps

1. Fix the boot failure (`FEATURES.md` #0a) — none of this is testable until the
   server starts
2. Re-validate the alert at approval time — closes the double-correction bug
3. Freeze the alert snapshot onto the record at creation
4. Split `draft` / `finalDraft`
5. One open action per alert
6. `action_events` + `GET /api/actions/:id/events`
7. Scope actions to `user_id` when multi-tenancy lands

## Tests to add

The existing HTTP test already covers the happy path — draft →
approve → stock correction → restart → still there — plus 409 on double-approve
and on dismiss-after-approve. Worth adding:

- Approve two sibling actions for the same alert; assert stock moves **once**
- Approve an action whose alert has since resolved; assert it is rejected
- Freeze integrity: mutate orders after creation, assert the record still reports
  the original numbers
- Assert the model's original draft survives approval alongside the edited text

## Settled

The plan's open question — whether a dismissed alert stays dismissed when it
recurs — is answered by the implementation: it does not. Dismissal marks one
record, and the alert reappears in `GET /api/alerts` on the next request, because
detection reads only products and orders. That is defensible for a shortage that
genuinely recurs; revisit only if the UI gets noisy.
