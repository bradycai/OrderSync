# OrderSync Backend — Feature Backlog

Where the backend stands today (`backend/src/index.ts`):

- `GET  /api/status` — demo-mode flag + model id
- `POST /api/extract` — email text → structured order (AI)
- `POST /api/match` — listing title → SKU suggestion (AI)
- `POST /api/draft` — context → customer message (AI)
- `POST /api/auth/{signup,signin,signout}`, `GET /api/auth/me` — scrypt hashes,
  cookie sessions, JSON files under `backend/data/`

Everything else is frontend-only. The domain model, the seed catalog, the stock
math (`frontend/src/lib/inventory.ts`), dedupe (`lib/orders.ts`), alerts
(`lib/alerts.ts`), and timing runs all live in a React `useState` store that
resets on reload. **The single biggest gap is that the backend owns no domain
state at all.** The list below is ordered so that gap closes first.

---

## Tier 1 — Make the backend own the data

Without these, every other feature is building on sand: two browser tabs
disagree, a reload wipes the demo, and nothing is per-user.

### 1. Persistence layer beyond `jsonTable`
`fileStore.ts` rewrites the whole array on every write and has no locking — two
concurrent imports can lose one. Its own comment already calls out the intent:
"Swapping this file for SQLite is the only change a real store would need."

- Move to SQLite (`better-sqlite3` or `libsql`) with a migrations folder.
- Tables: `users`, `sessions`, `products`, `listing_maps`, `orders`,
  `order_lines`, `actions`, `timing_runs`.
- Every domain row carries a `user_id` — the prototype is single-tenant by
  accident, not by design.

### 2. Orders API
- `GET    /api/orders` — filter by `channel`, `status`, free-text `q`, paginated
- `GET    /api/orders/:key`
- `POST   /api/orders` — import; runs the same upsert rule as `lib/orders.ts`
- `PATCH  /api/orders/:key` — status changes, line edits
- `DELETE /api/orders/:key`

Identity stays `channel + channelOrderId`. Enforce it as a **unique index**, not
just an application-level `find` — that turns idempotency into a database
guarantee instead of a convention.

### 3. Server-side deterministic engine
Port `inventory.ts`, `orders.ts`, and `alerts.ts` into `backend/src/domain/` and
have the frontend read results instead of computing them.

- `GET /api/inventory` — `InventorySnapshot[]`, recomputed from current orders
- `GET /api/alerts` — shortage + overdue detection
- `GET /api/overview` — one payload for the dashboard (counts, alerts, snapshots)

Keeps the README's rule intact: AI handles judgment, TypeScript handles
arithmetic — it just runs on the server where the data is.

### 4. Products & listing maps API
- `GET/POST/PATCH /api/products` — catalog and `startingStock`
- `GET /api/listing-maps`
- `POST /api/listing-maps/:id/confirm` / `/reject` — closes the one open `TODO`
  in the codebase (`frontend/src/pages/Inventory.tsx:27`)
- Pending maps stay excluded from stock math until confirmed

### 5. Actions & approvals API
- `POST  /api/actions` — create from an alert's `suggestedAction`
- `PATCH /api/actions/:id` — edit draft, approve (simulated), dismiss
- Persist `decidedAt` and the final edited draft — right now approvals vanish
- Immutable audit log: who approved what, when, and the exact text sent

### 6. Per-user seed & reset
`POST /api/demo/reset` — reseed that user's rows from a server-side copy of
`frontend/src/data/seed.ts`. Move `DEMO_NOW` and the sample emails to the
backend too, so the demo script is not duplicated across the two workspaces.

---

## Tier 2 — Harden what already exists

### 7. Request validation on every route
`/api/extract`, `/api/match`, and `/api/draft` read `req.body` through raw `as`
casts. A missing `catalog` on `/api/match` throws inside the handler. Zod
schemas exist for model *output* — add them for input, and reuse `firstIssue()`
from `auth/routes.ts` for consistent error shapes.

### 8. Error handling & structured logging
- Express 5 async error middleware — one place that turns a throw into a
  response, instead of a try/catch per route
- Request id per call, propagated into logs and error bodies
- A model failure should log the request id, not the email body

### 9. Rate limiting & cost controls
Every AI route is an unmetered call to a paid API behind a cookie.

- Per-user limits on `/api/extract`, `/api/match`, `/api/draft`
- Max payload size per route (the global `1mb` is too generous for `/api/match`)
- Record token usage per call; expose a per-user monthly total

### 10. Auth gaps
- Session rotation on sign-in (currently every sign-in appends a new row)
- `GET /api/auth/sessions` + revoke-all-devices
- Password change and reset flow
- Sign-in attempt throttling — the generic-error branch prevents enumeration but
  nothing slows a password guesser down
- Prune expired sessions on a timer, not only as a side effect of writes

### 11. CSRF protection
Cookie auth with `sameSite: "lax"` covers the common case, but state-changing
routes should carry a double-submit token before this is deployed anywhere.

### 12. Health & readiness
Split `/api/status` into `/api/health` (liveness, no auth) and keep the
demo-mode/model info where it is. Add DB connectivity to the readiness check.

---

## Tier 3 — New capability

### 13. Real channel connectors
Replace pasted email with actual ingestion, behind one `ChannelAdapter`
interface so Shopify/TikTok/Amazon/eBay differ only in their adapter.

- Webhook receivers with signature verification per channel
- OAuth token storage and refresh
- Polling fallback with cursor-based sync state
- Dry-run mode so the prototype keeps working with no credentials

### 14. Inbound email ingestion
A mail webhook (Postmark/SES) that pipes straight into `/api/extract`, so orders
land without anyone copy-pasting.

### 15. Background jobs
- Overdue-shipment sweep on a schedule instead of on-render
- Low-stock digest
- Retry queue for failed model calls
- A durable job table beats `setInterval` once there is more than one process

### 16. Notifications
Email/push when an alert crosses critical, with per-user thresholds and quiet
hours. `LOW_STOCK_THRESHOLD` is currently a hardcoded `2` in the frontend.

### 17. Simulated outward actions become real
Behind an explicit per-user opt-in flag: send the approved customer email, push
the stock correction to each marketplace. Keep simulation the default — the
README promises nothing leaves the machine.

### 18. Export & reporting
- `GET /api/export/orders.csv`
- Inventory history — snapshot daily so stock movement is chartable
- Timing runs persisted server-side for the manual-vs-assisted comparison

### 19. AI streaming and caching
- Stream `/api/draft` so the founder sees text appear rather than waiting
- Cache `/api/match` results by `listingTitle + catalog hash` — the same
  unmatched title is re-sent on every import today
- Prompt caching on the system prompts

---

## Tier 4 — Engineering foundation

### 20. Test suite
There are zero tests. The deterministic logic is the highest-value target and
the easiest to cover: stock math, dedupe/upsert idempotency, `defaultShipBy`
business-day arithmetic, alert thresholds, password verify against malformed
stored values.

- Vitest for unit tests, supertest for routes
- An in-memory SQLite fixture per test

### 21. API contract shared with the frontend
Export the Zod schemas from a shared workspace package (or generate an OpenAPI
spec) so `frontend/src/types.ts` stops being a hand-maintained copy of the
backend's shapes.

### 22. Deployment
Dockerfile, a real `build` script for the backend (today `start` runs `tsx` over
TypeScript source), config validation at boot that fails loudly on a bad `.env`,
and graceful shutdown.
