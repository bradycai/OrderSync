# OrderSync Backend — Feature Backlog

Last revised against commit `7eb554c` (merge of `bradycai/Jayden`).

Legend: ✅ shipped · 🟡 partial · ⬜ not started · 🔴 broken

## What changed since the first draft

Most of Tier 1 landed, and the architecture moved further than the original plan
asked for. A third workspace, `shared/`, now holds the domain model and all the
deterministic logic, imported by both the API and the UI — that was #21, and
doing it early made #3 nearly free. The frontend no longer computes anything:
`store.tsx` is a cache over five API calls with a single `refresh()`.

Persistence (#1) landed on `node:sqlite` with no new dependency. The schema is
**one JSON blob per row** (`id TEXT PRIMARY KEY, data TEXT CHECK(json_valid(data))`)
rather than the relational tables originally sketched — see #1 below for what
that costs. Order identity is a real unique index over
`json_extract(data,'$.channel')` + `json_extract(data,'$.channelOrderId')`, so
the dedupe guarantee is enforced by the database as intended.

**Two regressions arrived with the merge and are now the top of the list.**

---

## Tier 0 — Broken, fix first

### 🔴 0a. The API does not boot
`backend/src/index.ts:14,16` call `cookieParser()` and mount `authRoutes`, but
neither is imported — the import lines were lost in the merge.

```
ReferenceError: cookieParser is not defined
    at backend/src/index.ts:14:5
```

`cookie-parser` was also dropped from `backend/package.json` dependencies (only
`@types/cookie-parser` survives, in devDependencies). It is still physically
present in `node_modules` from the earlier install, which is why the breakage
looks like a missing import rather than a missing package.

This is also why `backend/test/database.test.ts` fails — "API exited 1". The
SQLite unit test passes; every HTTP assertion in the second test is unreachable.

Fix: restore both imports, move `cookie-parser` back to `dependencies`.

### 🔴 0b. The frontend auth layer is orphaned the same way
`frontend/src/App.tsx:13` calls `useAuth()` with no import, and `SignIn`/`SignUp`
are imported but never rendered — there is no signed-out branch any more.
`components/Sidebar.tsx:16` destructures an unused `user`.

```
src/App.tsx(13,22): error TS2304: Cannot find name 'useAuth'
```

`frontend/src/auth/AuthProvider.tsx` still exists and is unreferenced.

### 🔴 0c. `npm run typecheck` and `npm test` both fail
After a fresh `npm install` (needed anyway — the `@orderwatch/shared` symlink is
absent from `node_modules` until workspaces are re-linked), the only remaining
type errors are 0a and 0b. Getting these two green is the gate for everything
below.

### 🔴 0d. Every domain route is unauthenticated
`requireAuth` is defined in `auth/middleware.ts` and applied to **zero** routes.
`/api/orders`, `/api/inventory`, `/api/alerts`, `/api/actions`, and
`/api/demo/reset` are all open, and `/api/orders/parse-email` spends model
tokens on unauthenticated input.

There is also no `user_id` anywhere in the schema — the store is single-tenant
by construction, so gating the routes is necessary but not sufficient. See #2.

---

## Tier 1 — Finish what's started

### 🟡 1. Persistence
✅ `node:sqlite`, WAL, `busy_timeout`, `PRAGMA user_version` migration gate,
transactional `write()` with rollback, explicit `reset()`. Covered by a passing test.

Remaining:
- **`save()` rewrites by whole-table diff.** Every `write()` reads all four
  tables, diffs each row's serialized JSON, and issues an upsert per change.
  That is the JSON-array read-modify-write pattern re-implemented inside a
  transaction — correct, but it scales with total row count, not change count.
- **JSON blobs can't be indexed or queried.** Filtering in `GET /api/orders`
  happens in JS over every row. A relational `orders`/`order_lines` split is the
  eventual fix; a generated-column index is the cheap one.
- **No `user_id` column**, which blocks multi-tenancy (#2).

### ⬜ 2. Multi-tenancy
Promoted out of #1 because it is now the single largest structural gap. Add
`user_id` to every domain row, scope every query to `req.user.id`, and make
`/api/demo/reset` reseed one user rather than the whole database.

### 🟡 3. Orders API
✅ `GET /api/orders` with `channel` / `status` / `q` filters,
`POST /api/orders/parse-email` (preview-only, nothing written),
`POST /api/orders` (upsert, unknown-SKU rejection, `rememberMapping` teaches the
mapping on confirm).

Remaining:
- `GET /api/orders/:key` — no single-order fetch exists
- `PATCH /api/orders/:key` — status changes and line edits; marking an order
  shipped or canceled is currently impossible through the API, which means the
  "canceled orders release stock" rule cannot actually be exercised
- `DELETE /api/orders/:key`
- Pagination — `GET /` returns every matching row

### ✅ 4. Server-side deterministic engine
Logic lives in `shared/`; `GET /api/inventory` and `GET /api/alerts` recompute
per request. `AlertsResponse` ships `supportingOrders` so the UI needs no second
call.

One open item: `GET /api/overview`. `store.tsx` `refresh()` fires five parallel
requests on every filter keystroke, and `channelFilter`/`search` are in the
`useCallback` deps — so typing in the search box refetches status, inventory,
alerts, and actions along with orders.

### 🟡 5. Products & listing maps
✅ Mappings are taught on import (`rememberMapping` in `routes/orders.ts:215`);
pending matches surface through `GET /api/inventory`.

Remaining:
- `GET/POST/PATCH /api/products` — no catalog CRUD; `startingStock` is editable
  only as a side effect of approving an `adjust_inventory` action
- `POST /api/listing-maps/:id/confirm` / `/reject` — `Inventory.tsx` lists
  pending matches read-only, with no way to act on one
- Nothing ever writes a `pending` mapping: `parse-email` returns suggestions in
  the preview, and `POST /orders` records only confirmed ones. The `pending`
  state and `source: "ai"` are effectively dead until this lands.

### ✅ 6. Actions & approvals
Shipped, with a different shape than planned — draft generation creates the
action at `POST /api/alerts/:id/draft`, and a `Resolution` enum lets the founder
pick the fix before drafting. See `docs/plan-05-actions-api.md` for the delta
and the audit-trail gaps that remain open.

### 🟡 7. Seed & reset
✅ `POST /api/demo/reset`, seed in `shared/src/seed.ts`, `DEMO_NOW` fixed clock.
Remaining: per-user scoping (#2), and the route is unauthenticated — anyone who
can reach the port can wipe the database.

---

## Tier 2 — Harden

### 🟡 8. Request validation
✅ Zod on every route body and on `GET /api/orders` query params.
Remaining: `customerEmail` is `z.string().min(1)` — not an email check, so
`parse-email` output goes in unvalidated.

### 🟡 9. Error handling & logging
✅ Global error middleware and a JSON 404 handler in `index.ts`.
Remaining: the handler returns `err.message` verbatim to the client, which will
leak internals once anything real is behind it. No request ids, no structured logs.

### ⬜ 10. Rate limiting & cost controls
Unchanged and now more urgent: `parse-email` makes one extraction call **plus one
match call per unresolved line**, unauthenticated, with no cap.

### 🟡 11. Auth gaps
Blocked on 0a/0b. Once restored: session rotation on sign-in, revoke-all-devices,
password change/reset, sign-in throttling, expired-session pruning on a timer.

### ⬜ 12. CSRF protection
### 🟡 13. Health & readiness
✅ `/api/status` returns `demoMode`, `model`, `simulated: true`.
Remaining: split liveness onto an unauthenticated `/api/health` with a DB check.

---

## Tier 3 — New capability

Unchanged from the first draft: ⬜ 14 channel connectors behind one
`ChannelAdapter` · ⬜ 15 inbound email ingestion · ⬜ 16 background jobs
(the overdue sweep is recomputed per request against a frozen `DEMO_NOW`, so a
real clock is a prerequisite) · ⬜ 17 notifications · ⬜ 18 real outward actions
behind an opt-in · ⬜ 19 export & reporting · ⬜ 20 AI streaming and caching
(`parse-email` re-asks the model for the same listing title on every import).

---

## Tier 4 — Foundation

### 🟡 21. Tests
✅ `backend/test/database.test.ts` — two tests on `node:test`: SQLite
persistence/rollback/reset, and a full HTTP round-trip that restarts the server
to prove durability. Good shape.

Remaining:
- **The HTTP test currently fails** (0a) — fix that before adding more
- Unit coverage for `shared/`: stock math, upsert idempotency, `defaultShipBy`
  business-day arithmetic, alert thresholds, `resolveLine` on pending mappings
- `passwords.ts` `verifyPassword` against malformed stored values
- Route-level tests for the 400/404/409 branches

### ✅ 22. Shared API contract
`@orderwatch/shared` exports the domain model *and* the request/response types
(`ParsePreview`, `AlertsResponse`, `InventoryRow`, `DemoStatus`, …), consumed by
`frontend/src/api.ts`. The duplicate `frontend/src/types.ts` is gone.

Remaining: the Zod schemas still live in `backend/src/routes/*` and are
hand-mirrored by the TypeScript interfaces in `shared/src/types.ts`. Deriving the
interfaces from the schemas would close the last gap.

### ⬜ 23. Deployment
Dockerfile; a real build step (`start` still runs `tsx` over TypeScript source);
boot-time config validation; `engines` now pins Node ≥24 for `node:sqlite`, so
that constraint needs to survive into the runtime image.
