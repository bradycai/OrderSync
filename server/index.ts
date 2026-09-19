import "dotenv/config";
import express from "express";
import {
  DraftSchema,
  ExtractedOrderSchema,
  MatchSuggestionSchema,
  hasCredentials,
  parseWith,
} from "./claude";
import { demoDraft, demoExtract, demoMatch } from "./demoOutputs";

const app = express();
app.use(express.json({ limit: "1mb" }));

const demoMode = () => !hasCredentials();

app.get("/api/status", (_req, res) => {
  res.json({ demoMode: demoMode(), model: "claude-opus-5" });
});

/** AI step 1 — pull structured order fields out of pasted email text. */
app.post("/api/extract", async (req, res) => {
  const { email } = req.body as { email: string };
  if (!email?.trim()) {
    res.status(400).json({ error: "email body required" });
    return;
  }

  if (demoMode()) {
    res.json({ ...demoExtract(email), demoMode: true });
    return;
  }

  try {
    const out = await parseWith(
      ExtractedOrderSchema,
      "You extract order details from e-commerce notification emails. " +
        "Copy listing titles verbatim — do not normalize them. " +
        "Return ISO 8601 timestamps in UTC. If the ship-by date is absent, return null.",
      email,
    );
    res.json({ ...out, demoMode: false });
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
});

/** AI step 2 — propose a SKU for an unrecognized listing title. */
app.post("/api/match", async (req, res) => {
  const { listingTitle, catalog } = req.body as {
    listingTitle: string;
    catalog: { sku: string; title: string; color: string; size: string }[];
  };

  if (demoMode()) {
    res.json({ ...demoMatch(listingTitle), demoMode: true });
    return;
  }

  try {
    const out = await parseWith(
      MatchSuggestionSchema,
      "You map marketplace listing titles to internal SKUs. Return null for sku " +
        "when nothing is a plausible match. Confidence below 0.9 means a human must confirm.",
      `Listing: ${listingTitle}\n\nCatalog:\n${JSON.stringify(catalog, null, 2)}`,
    );
    res.json({ ...out, demoMode: false });
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
});

/** AI step 3 — draft the customer message the founder will edit and approve. */
app.post("/api/draft", async (req, res) => {
  const { context } = req.body as { context: string };

  if (demoMode()) {
    res.json({ ...demoDraft(context ?? ""), demoMode: true });
    return;
  }

  try {
    const out = await parseWith(
      DraftSchema,
      "You write short, warm, plain customer-service emails for a small clothing brand. " +
        "No corporate filler. Be specific about what went wrong and what happens next. " +
        "Always offer a refund alternative. Under 120 words.",
      context,
    );
    res.json({ ...out, demoMode: false });
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
});

const port = Number(process.env.API_PORT ?? 8787);
app.listen(port, () => {
  console.log(
    `OrderWatch API on :${port} — ${demoMode() ? "DEMO MODE (no ANTHROPIC_API_KEY)" : "live model"}`,
  );
});
