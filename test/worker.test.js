import test from "node:test";
import assert from "node:assert/strict";
import worker from "../backend/src/index.js";

test("health reveals no secret and reports sending disabled", async () => {
  const response = await worker.fetch(new Request("https://example.test/health"), { SEND_ENABLED: "false" });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, service: "ali-eitaa-reports", send_enabled: false });
});

test("send endpoint fails closed before database or provider access", async () => {
  const response = await worker.fetch(new Request("https://example.test/v1/reports/r1/send", {
    method: "POST", headers: { authorization: "Bearer operator", "content-type": "application/json" },
    body: JSON.stringify({ idempotency_key: "once" })
  }), { SEND_ENABLED: "false", OPERATOR_API_KEY: "operator" });
  assert.equal(response.status, 423);
  assert.deepEqual(await response.json(), { ok: false, error: "send_disabled" });
});

test("operator endpoints fail closed when API key is absent", async () => {
  const response = await worker.fetch(new Request("https://example.test/v1/onboarding/nonces", {
    method: "POST", headers: { "content-type": "application/json" }, body: "{}"
  }), { SEND_ENABLED: "false" });
  assert.equal(response.status, 401);
});
