/** Translate provider errors without exposing request headers, keys, or input data. */
export function aiFailureReason(error: unknown): string {
  const e = error as { status?: number; name?: string; message?: string; error?: { error?: { message?: string } } } | null;
  const message = String(e?.error?.error?.message ?? e?.message ?? "").toLowerCase();
  if (message.includes("credit balance") || message.includes("insufficient credit")) {
    return "Anthropic API credits are too low. Add credits in Claude Console → Plans & Billing, then click Auto-resolve again. Your warning was not changed.";
  }
  if (e?.status === 401) return "Anthropic rejected the API key. Check ANTHROPIC_API_KEY in the root .env and restart the backend.";
  if (e?.status === 403) return "Your Anthropic account does not have permission for this request. Check API key permissions and model access.";
  if (e?.status === 404) return "The configured Anthropic model is unavailable to this account. Check model access.";
  if (e?.status === 429) return "Anthropic's rate limit was reached. Wait a moment, then retry. Your warning was not changed.";
  if (e?.name === "APIConnectionError" || e?.name === "APIConnectionTimeoutError") return "Could not reach Anthropic. Check the backend's internet connection, then retry.";
  if (e?.status && e.status >= 500) return "Anthropic is temporarily unavailable. Retry shortly. Your warning was not changed.";
  return "Could not prepare the AI follow-up. Left for manual review; you can retry.";
}
