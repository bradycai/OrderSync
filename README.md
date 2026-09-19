# OrderWatch

An operations assistant for a one-person e-commerce brand selling across Shopify,
TikTok Shop, Amazon, and eBay. It watches orders across every channel, does the
stock arithmetic, flags what is about to go wrong, and drafts the fix for you to
approve.

> **Prototype.** All data is synthetic and every outward action — customer emails,
> marketplace stock updates — is simulated. Nothing leaves your machine.

## Setup

Requires **Node 20+**.

```bash
npm install
npm run dev          # web on :5173, API on :8787
```

Open http://localhost:5173.

### AI credentials (optional)

OrderWatch runs fully without an API key. To use the real model:

```bash
cp .env.example .env
# then set ANTHROPIC_API_KEY=sk-ant-... in .env
npm run dev
```

With a key, `/api/extract`, `/api/match`, and `/api/draft` call `claude-opus-5`
and the header shows **Live model**.

**Without a key, demo mode kicks in automatically** — the same endpoints return
prepared sample outputs, the header shows an amber *Demo mode* pill, and every
AI-produced field in the UI is tagged `demo mode output`. The full demo works
either way; nothing fails silently.

There is a third fallback: if the API server is not running at all (say you ran
`vite` on its own), the browser uses built-in sample outputs and the header reads
*Demo mode — API offline*. The demo still completes end to end.

## The 5-minute demo

1. **Import email** → *Load a sample* → “TikTok Shop — new order” → **Extract order
   details** → review the preview → **Import order**. You land on the new order.
2. Go back to **Import email**, load the **Shopify duplicate** sample, extract it.
   The preview says order `shopify:1042` already exists and will be **updated in
   place**. Import it — the order count does not move.
3. **Overview** → filter by channel, search, click any row for full detail
   including its notification history.
4. **Needs attention** → the black medium hoodie is oversold. The alert shows
   `5 − 7 = -2` and every contributing order. Click it.
5. Edit the AI-drafted message in place, then **Approve and send (simulated)**.
   The alert leaves the queue, the sidebar count drops, and a toast confirms the
   action was simulated. Or switch to *Record a restock* and approve that instead —
   that one genuinely changes starting stock and the shortage disappears from the
   arithmetic.
6. **Inventory** → confirm or reject the uncertain Amazon match and watch committed
   stock change. Click any SKU row to expand the orders holding it.
7. **Demo timer** → time the same reconciliation by hand and with the app.
8. **Reset demo** in the sidebar returns everything to the seeded state.

### The seeded scenario

Five black medium hoodies (`HOODIE-BLK-M`) are in stock. Shopify, TikTok Shop, and
eBay have each sold two — six committed against five on hand, so one unit is
short. A canceled TikTok order for the same SKU is correctly excluded, and an
Amazon order sits behind an unconfirmed listing match, holding no stock until a
human confirms it.

## Design rules

- **AI is used for judgment, never arithmetic.** Email extraction, uncertain SKU
  matching, and message drafting go to the model. Stock math, duplicate detection,
  deadlines, and alert thresholds are plain deterministic TypeScript. Every seam
  where model output is currently mocked is marked `TODO: replace with real AI call`.
- **Starting stock is immutable.** `Product.startingStock` is physical stock on hand.
  Commitments are recomputed from the current order list on every render
  (`src/lib/inventory.ts`), so re-importing a notification can never double-deduct.
- **Canceled orders hold no stock**, and lines whose SKU match is still
  `pending_review` are excluded from commitments until a human confirms them.
- **Identity is `channel + marketplace order id`** (`src/lib/orders.ts`). That single
  rule is what makes repeated notifications idempotent.
- **Uncertain matches stay pending.** A suggestion below 0.9 confidence goes to the
  review queue and holds no stock; it is never auto-applied.
- **Approving is honest.** Approving a *message* marks the alert handled — it does
  not invent stock. Approving a *stock correction* edits starting stock, so the
  shortage stops being detected at all. Alerts carry a content signature, so if the
  numbers move after you handled one, it returns to the queue.
- **No time-savings claims.** The demo timer reports only what you measured in this
  session, and the comparison stays blank until both runs exist.

## Layout

```
server/
  index.ts         Express API: /api/status, /api/extract, /api/match, /api/draft
  claude.ts        Anthropic client, model id, Zod output schemas
  demoOutputs.ts   Prepared sample outputs used when no API key is present
src/
  types.ts         Domain model
  store.tsx        In-memory state + every handleX action, one per button
  data/seed.ts     Synthetic catalog, listing maps, orders, sample emails
  lib/ai.ts        The only seam to model calls, with labeled offline fallbacks
  lib/inventory.ts Deterministic stock math
  lib/orders.ts    Identity, dedupe/upsert, deadlines, SKU resolution
  lib/alerts.ts    Shortage and overdue detection
  lib/timing.ts    Manual vs assisted timing
  components/      Sidebar, drawers, order + alert detail, toasts, primitives
  pages/           Overview, Attention, Inventory, Intake, Timing
```

Every button is wired to a named handler in `src/store.tsx` (`handleApprove`,
`handleImportOrder`, `handleEditSubmit`, `handleConfirmMatch`, …) so a real API
call can replace any one of them without touching the UI.

State is in-memory only — a reload restores the seed data, which is the behavior
you want in a demo.
