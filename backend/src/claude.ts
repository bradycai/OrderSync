import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

/** Model used for every assisted step. */
export const MODEL = "claude-opus-5";

export const hasCredentials = () =>
  Boolean(process.env.ANTHROPIC_API_KEY?.trim());

let client: Anthropic | null = null;
export function getClient(): Anthropic {
  if (!client) client = new Anthropic();
  return client;
}

/** Shapes the model must return. Validated before anything reaches the UI. */
export const ExtractedOrderSchema = z.object({
  channel: z.enum(["shopify", "tiktok", "amazon", "ebay"]),
  channelOrderId: z.string(),
  customerName: z.string(),
  customerEmail: z.string(),
  placedAt: z.string().describe("ISO 8601 timestamp"),
  shipBy: z.string().nullable().describe("ISO 8601, or null if not stated"),
  status: z.enum(["awaiting_shipment", "shipped", "delivered", "canceled"]),
  lines: z.array(
    z.object({
      listingTitle: z.string().describe("verbatim marketplace listing name"),
      quantity: z.number().int().positive(),
    }),
  ),
  notes: z.string().describe("anything ambiguous the founder should check"),
});

export const MatchSuggestionSchema = z.object({
  sku: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
});

export const DraftSchema = z.object({
  subject: z.string(),
  body: z.string(),
});

type Schema = z.ZodType;

/** One place for every model call, so demo mode has a single seam. */
export async function parseWith<T extends Schema>(
  schema: T,
  system: string,
  userContent: string,
): Promise<z.infer<T>> {
  const response = await getClient().messages.parse({
    model: MODEL,
    max_tokens: 4000,
    thinking: { type: "adaptive" },
    output_config: { format: zodOutputFormat(schema) },
    system,
    messages: [{ role: "user", content: userContent }],
  });

  if (!response.parsed_output) {
    throw new Error("Model returned no parseable output");
  }
  return response.parsed_output as z.infer<T>;
}
