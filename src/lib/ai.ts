import type { DraftMessage, ExtractedOrder, MatchSuggestion, Product } from "../types";

/**
 * The single seam between the UI and anything model-powered.
 *
 * Three layers, in order of preference:
 *   1. The local API proxy (`server/index.ts`), which calls Claude when
 *      ANTHROPIC_API_KEY is set.
 *   2. That same proxy in demo mode, returning prepared sample outputs.
 *   3. These in-browser fallbacks, used when the proxy is unreachable at all
 *      (e.g. someone ran `vite` alone). Always flagged `demoMode: true`.
 *
 * Everything that comes back carries a `demoMode` flag, and the UI labels it.
 * AI is used for judgment only — extraction, fuzzy matching, and drafting.
 * Stock math, duplicate detection, and deadlines never pass through here.
 */

async function postJson<T>(path: string, body: unknown, fallback: () => T): Promise<T> {
  try {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`${path} returned ${res.status}`);
    return (await res.json()) as T;
  } catch {
    // The API proxy is not running. Degrade to a labeled demo response rather
    // than failing the demo silently.
    return fallback();
  }
}

/** AI step 1 — pull structured order fields out of pasted email text. */
export function extractOrderFromEmail(email: string): Promise<ExtractedOrder> {
  return postJson<ExtractedOrder>("/api/extract", { email }, () =>
    localExtract(email),
  );
}

/** AI step 2 — propose a SKU for an unrecognized listing title. */
export function suggestMatch(
  listingTitle: string,
  catalog: Product[],
): Promise<MatchSuggestion> {
  return postJson<MatchSuggestion>(
    "/api/match",
    {
      listingTitle,
      catalog: catalog.map(({ sku, title, color, size }) => ({ sku, title, color, size })),
    },
    () => localMatch(listingTitle, catalog),
  );
}

/** AI step 3 — draft the customer message the founder edits and approves. */
export function draftMessage(context: string): Promise<DraftMessage> {
  return postJson<DraftMessage>("/api/draft", { context }, () => localDraft());
}

/* ------------------------------------------------------------------ *
 * Offline fallbacks. Mirrors server/demoOutputs.ts.
 * TODO: replace with real AI call — these exist only so the prototype
 * still demonstrates the full flow with no API key and no server.
 * ------------------------------------------------------------------ */

function localExtract(email: string): ExtractedOrder {
  // TODO: replace with real AI call. Crude pattern matching stands in for
  // genuine extraction so the sample emails still walk the flow offline.
  if (/#?\s*1042/.test(email)) {
    return {
      channel: "shopify",
      channelOrderId: "1042",
      customerName: "Priya Raman",
      customerEmail: "priya@example.com",
      placedAt: "2026-09-17T09:00:00Z",
      shipBy: "2026-09-20T17:00:00Z",
      status: "awaiting_shipment",
      lines: [{ listingTitle: "Heavyweight Hoodie — Black / M", quantity: 2 }],
      demoMode: true,
      notes: "Repeat notification for an order OrderWatch already holds.",
    };
  }
  if (/114-7781220/.test(email)) {
    return {
      channel: "amazon",
      channelOrderId: "114-7781220-3390115",
      customerName: "Harun Cetin",
      customerEmail: "hcetin@example.com",
      placedAt: "2026-09-19T10:22:00Z",
      shipBy: "2026-09-23T17:00:00Z",
      status: "awaiting_shipment",
      lines: [{ listingTitle: "Corduroy 6-Panel Hat — Navy Blue, One Size", quantity: 1 }],
      demoMode: true,
      notes: "This listing name is not in the mapping table — it will need a SKU match.",
    };
  }
  return {
    channel: "tiktok",
    channelOrderId: "TT-88402",
    customerName: "Nina Osei",
    customerEmail: "nina.osei@example.com",
    placedAt: "2026-09-19T08:14:00Z",
    shipBy: "2026-09-22T17:00:00Z",
    status: "awaiting_shipment",
    lines: [
      { listingTitle: "Oversized Black Hoodie (Medium)", quantity: 1 },
      { listingTitle: "Cord Cap Navy", quantity: 1 },
    ],
    demoMode: true,
    notes: "Offline demo output — the API proxy was not reachable.",
  };
}

function localMatch(listingTitle: string, catalog: Product[]): MatchSuggestion {
  // TODO: replace with real AI call.
  const words = listingTitle.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  let best: { sku: string; score: number } | null = null;

  for (const p of catalog) {
    const haystack = `${p.title} ${p.color} ${p.size}`.toLowerCase();
    const score = words.filter((w) => haystack.includes(w)).length / (words.length || 1);
    if (!best || score > best.score) best = { sku: p.sku, score };
  }

  if (!best || best.score < 0.25) {
    return {
      sku: null,
      confidence: Math.round((best?.score ?? 0) * 100) / 100,
      reasoning: "No catalog entry shares enough wording with this listing title.",
      demoMode: true,
    };
  }
  return {
    sku: best.sku,
    // Deliberately capped below the auto-confirm bar: an offline guess should
    // always land in the founder's review queue, never auto-resolve.
    confidence: Math.min(0.72, Math.round(best.score * 100) / 100),
    reasoning:
      `Offline word-overlap guess: “${listingTitle}” shares most of its wording ` +
      `with ${best.sku}. Confirm before it counts against stock.`,
    demoMode: true,
  };
}

function localDraft(): DraftMessage {
  // TODO: replace with real AI call.
  return {
    subject: "A short delay on your order",
    body:
      "Hi there,\n\nThanks for your order. We sold through this size across a few " +
      "storefronts at the same time, and yours is the one that came up short. Our " +
      "next batch lands within the week, and I'll ship yours the day it arrives.\n\n" +
      "If you'd rather not wait, reply and I'll refund you in full today.\n\n— The team",
    demoMode: true,
  };
}
