# OrderWatch

An operations assistant for a one-person e-commerce brand selling across Shopify,
TikTok Shop, Amazon, and eBay. It watches orders across every channel, does the
stock arithmetic, flags what is about to go wrong, and drafts the fix for you to
approve.

> **Prototype.** All data is synthetic and every outward action (customer emails,
> marketplace stock updates) is simulated. Nothing leaves your machine.

## Status

The backend is real: orders, email import, inventory, alerts, drafting, and approval
history all run through the API. State is saved in a local SQLite database and survives backend restarts.
The database is created and seeded automatically on first launch.

## Demo flow

1. **Import email** → load the TikTok Shop sample → *Extract order details* → review
   the preview → import.
2. Load the **Shopify duplicate** sample and import it again — the preview says it
   will update order `shopify:1042` in place rather than create a second copy.
3. **Overview** → the order appears in the unified table; filter by channel.
4. **Needs attention** → 5 black medium hoodies in stock, but Shopify, TikTok Shop,
   and eBay each sold 2. The alert shows `5 − 6 = -1` and all three contributing orders.
5. Open the alert → pick a resolution (delay, partial shipment, refund, or stock
   correction) → *Draft the message* → edit it → **Approve (simulated)**.
6. **Reset demo** in the sidebar returns everything to the seeded state.

## Design rules

- **AI is used for judgment, never arithmetic.** Email extraction, uncertain SKU
  matching, and message drafting go to the model. Stock math, duplicate detection,
  deadlines, and alert thresholds are plain deterministic TypeScript.
- **Starting stock is immutable.** `Product.startingStock` is physical stock on hand.
  Commitments are derived from the current order list on every request
  (`shared/src/inventory.ts`), so re-importing a notification can never double-deduct.
- **Canceled orders hold no stock**, and lines whose SKU match is still
  `pending_review` are excluded from commitments until a human confirms them.
- **Identity is `channel + marketplace order id`** (`shared/src/orders.ts`). That single
  rule is what makes repeated notifications idempotent, and the server enforces it.
- **Uncertain matches stay out of the math.** A suggested SKU below 90% confidence is
  held as `pending_review` and contributes nothing to committed stock until the founder
  confirms it on import — at which point the mapping is remembered for next time.

## API

All endpoints are under `/api`. The Vite dev server proxies to `:8787`.

| Method | Endpoint | What it does |
|---|---|---|
| `GET` | `/api/status` | Demo-mode flag and model id. `simulated` is always `true`. |
| `GET` | `/api/orders` | Lists orders. Filters: `?channel=`, `?status=`, `?q=`. |
| `POST` | `/api/orders/parse-email` | AI-extracts an order from pasted text and resolves each line to a SKU. Returns a preview; **writes nothing**. |
| `POST` | `/api/orders` | Saves the reviewed order. Deduped on channel + order ID: a repeat returns `200 updated`, a new one `201 created`. |
| `GET` | `/api/inventory` | Starting stock, committed, available per SKU, recomputed from live orders. |
| `GET` | `/api/alerts` | Shortages and overdue orders, with the supporting order records. |
| `POST` | `/api/alerts/:id/draft` | Drafts a customer message for the chosen `resolution`. Creates a `pending_review` action. |
| `POST` | `/api/actions/:id/approve` | Records the decision. Marked simulated; nothing is sent. |
| `GET` | `/api/actions` | Approval history. |
| `POST` | `/api/demo/reset` | Back to the seeded state. |

### Resolutions

`POST /api/alerts/:id/draft` takes one of `delay_and_apologize`, `partial_shipment`,
`offer_refund`, `cancel_and_refund`, or `inventory_correction`. The choice drives the
draft. `inventory_correction` is the one action that changes stored state on approval —
and it adjusts *starting stock*, the field an import never touches.

## Layout

Three npm workspaces.

```
shared/src/        Domain model + deterministic logic, imported by both sides
  types.ts           Model and API contract
  seed.ts            Synthetic catalog, listing maps, orders, sample emails
  inventory.ts       Stock math
  orders.ts          Identity, dedupe/upsert, deadlines, SKU resolution
  alerts.ts          Shortage and overdue detection
backend/src/
  index.ts           Express app and route wiring
  db.ts              SQLite connection and database path
  ai.ts              The only live-model vs demo-mode branch
  claude.ts          Anthropic client, model id, Zod output schemas
  demoOutputs.ts     Hand-written outputs used when no API key is present
  routes/            orders, inventory, alerts, actions
frontend/src/
  api.ts             Typed client for the endpoints above
  store.tsx          Caches server state; refresh() after every mutation
  pages/             Overview, Intake, Attention, Inventory
```

Server state persists across restarts. **Reset demo** replaces saved orders, products,
listing mappings, and action history with sample data.

## Run locally

Requires Node.js 24 or newer.

```sh
npm install
npm run dev
```

Open http://localhost:5173. SQLite defaults to `backend/data/orderwatch.sqlite`;
set `DATABASE_PATH` to an absolute path in the root `.env` to override it.
The database and its journal files are excluded from Git. Stop the backend before
copying the database file for a backup. No database service or credentials are required.

Schema version 1 is created automatically. Records are stored as keyed JSON rows in
products, orders, listingMaps, and actions tables, with a unique index on marketplace
channel + order ID. Imports and stock approvals use transactions. Sample data is
inserted only for a new database; restarting never overwrites existing records.
Marketplace actions are still simulated, and overdue alerts still use the demo clock.

Run persistence and API tests with `npm test -w backend`.
