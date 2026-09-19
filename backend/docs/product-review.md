# Product matching and stock correction review

This change is confined to product matching, inventory, and action review. It does
not modify signup/sign-in, auth middleware, app routing, package dependencies, or
shared styles.

## Product matches

- Intake offers every catalog SKU, plus an explicit pending-review choice.
- `GET /api/inventory/matches` groups unresolved order lines by channel and normalized
  listing title, including lines with no suggested SKU.
- `POST /api/inventory/matches/confirm` accepts `channel`, `listingTitle`, and `sku`.
  It validates the SKU and atomically confirms unresolved lines and remembers the
  mapping for future imports. Already-confirmed lines are left alone.
- Canceled orders still reserve no stock even after matching. Confirmation never
  changes starting stock. Repeated confirmations return 409.
- Selecting pending review explicitly during intake keeps a line pending even if
  a remembered mapping exists. Unresolved lines can be reviewed in Inventory later.

## Inventory corrections

The existing alert draft endpoint handles `inventory_correction` deterministically,
without an AI request. Its action records the proposed delta and expected starting
stock and commitments. The UI shows the calculation and asks the founder to verify
physical stock before approving. Approval modifies only the demo stock count and
records the simulated action status; it sends nothing externally.

If starting stock or commitments change after review, approval returns 409 without
modifying stock or action status. Old proposals without the stock snapshot must be
recreated. Multiple approvals cannot apply the same correction twice.

## Checks

Run `npm run typecheck`, `npm run build`, and `npm test -w backend`.
Tests use temporary databases, cover alternative matches and canceled orders, and
exercise confirmation, explicit pending imports, invalid/repeated requests, and
stale/duplicate stock approvals.

Manual demo: Inventory → confirm the pending Amazon listing → inspect recalculated
stock. Needs attention → choose stock correction → review the before/after values
→ approve the demo correction. No signup changes are needed for either flow.
