# OrderWatch

An operations assistant for a one-person e-commerce brand selling across Shopify,
TikTok Shop, Amazon, and eBay. It watches orders across every channel, does the
stock arithmetic, flags what is about to go wrong, and drafts the fix for you to
approve.

> **Prototype.** All data is synthetic and every outward action (customer emails,
> marketplace stock updates) is simulated. Nothing leaves your machine.

## Status: baseline scaffold

This repo is the starting skeleton — domain model, deterministic logic, seeded
demo data, AI endpoints, and a working UI shell. Search for `TODO` for the gaps.

## Setup

```bash
npm install              # one install covers both workspaces
cp .env.example .env     # optional — see AI credentials below
npm run dev              # web on :5173, API on :8787
```

`backend/` and `frontend/` are separate npm workspaces. Run one at a time with
`npm run dev:api` or `npm run dev:web`, or work inside a folder directly
(`npm run dev -w backend`).

### AI credentials

Set `ANTHROPIC_API_KEY` in `.env` to use the real model (`claude-opus-5`).
Without it the app boots in **demo mode**: the same endpoints return prepared
sample outputs, every one of them labeled in the UI. The demo flow works either way.

## Demo flow

1. **Import email** → load the TikTok Shop sample → *Extract order details* → review
   the preview → import.
2. Load the **Shopify duplicate** sample and import it again — the preview says it
   will update order `shopify:1042` in place rather than create a second copy.
3. **Overview** → the order appears in the unified table; filter by channel.
4. **Needs attention** → 5 black medium hoodies in stock, but Shopify, TikTok Shop,
   and eBay each sold 2. The alert shows `5 − 6 = -1` and all three contributing orders.
5. Open the alert → edit the AI-drafted customer message → **Approve (simulated)**.
6. **Demo timer** → time the same reconciliation manually and with the app.
7. **Reset demo** in the sidebar returns everything to the seeded state.

## Design rules

- **AI is used for judgment, never arithmetic.** Email extraction, uncertain SKU
  matching, and message drafting go to the model. Stock math, duplicate detection,
  deadlines, and alert thresholds are plain deterministic TypeScript.
- **Starting stock is immutable.** `Product.startingStock` is physical stock on hand.
  Commitments are recomputed from the current order list on every render
  (`frontend/src/lib/inventory.ts`), so re-importing a notification can never double-deduct.
- **Canceled orders hold no stock**, and lines whose SKU match is still
  `pending_review` are excluded from commitments until a human confirms them.
- **Identity is `channel + marketplace order id`** (`frontend/src/lib/orders.ts`). That single
  rule is what makes repeated notifications idempotent.
- **No time-savings claims.** The demo timer records only what you actually measure.

## Layout

```
backend/                 Express + Anthropic API (its own package.json)
  src/index.ts           /api/status, /api/extract, /api/match, /api/draft
  src/claude.ts          Anthropic client, model id, Zod output schemas
  src/demoOutputs.ts     Prepared sample outputs used when no API key is present
frontend/                Vite + React app (its own package.json)
  index.html
  vite.config.ts         Dev server on :5173, proxies /api to :8787
  src/types.ts           Domain model
  src/store.tsx          In-memory app state + reset
  src/data/seed.ts       Synthetic catalog, listing maps, orders, sample emails
  src/lib/inventory.ts   Deterministic stock math
  src/lib/orders.ts      Identity, dedupe/upsert, deadlines, SKU resolution
  src/lib/alerts.ts      Shortage and overdue detection
  src/lib/timing.ts      Manual vs assisted timing
  src/pages/             Overview, Intake, Attention, Inventory, Timing
.env                     Read by the backend; shared across the repo root
```

State is in-memory only — a reload restores the seed data, which is the behavior
you want in a demo.
