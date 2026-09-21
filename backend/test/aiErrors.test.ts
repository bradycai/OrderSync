import { test } from "node:test";
import assert from "node:assert/strict";
import { aiFailureReason } from "../src/aiErrors";

test("insufficient API credits produce actionable billing guidance", () => {
  assert.match(aiFailureReason({ status: 400, error: { error: { message: "Your credit balance is too low to access the Anthropic API." } } }), /Add credits/);
});
test("provider errors never expose keys or raw input", () => {
  for (const status of [400, 401, 403, 404, 429, 500]) {
    const result = aiFailureReason({ status, message: "secret-key customer-private-data" });
    assert.doesNotMatch(result, /secret-key|customer-private-data/);
  }
  assert.match(aiFailureReason({ status: 401 }), /API key/);
  assert.match(aiFailureReason({ status: 429 }), /rate limit/);
  assert.match(aiFailureReason({ name: "APIConnectionError" }), /internet connection/);
});
