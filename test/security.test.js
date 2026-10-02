import test from "node:test";
import assert from "node:assert/strict";
import { constantTimeEqual, validateEitaaInitData } from "../backend/src/security.js";

const enc = new TextEncoder();
const hex = bytes => Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
async function hmac(keyBytes, value) {
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(value)));
}
async function signedInitData(token, authDate, user) {
  const p = new URLSearchParams({ auth_date: String(authDate), user: JSON.stringify(user), query_id: "test-query" });
  const data = [...p.entries()].map(([k, v]) => `${k}=${v}`).sort().join("\n");
  const secret = await hmac(enc.encode("WebAppData"), token);
  p.set("hash", hex(await hmac(secret, data)));
  return p.toString();
}

test("constant-time comparison accepts only exact values", () => {
  assert.equal(constantTimeEqual("abc", "abc"), true);
  assert.equal(constantTimeEqual("abc", "abd"), false);
  assert.equal(constantTimeEqual("abc", "ab"), false);
});

test("valid signed initData is accepted and normalized", async () => {
  const now = 1_800_000_000;
  const token = "test-only-token";
  const initData = await signedInitData(token, now - 10, { id: 42, first_name: "Test", allows_write_to_pm: true });
  const result = await validateEitaaInitData(initData, token, { now, maxAgeSeconds: 300 });
  assert.equal(result.ok, true);
  assert.equal(result.user.id, "42");
  assert.equal(result.user.allows_write_to_pm, true);
});

test("tampering, stale auth and missing input fail closed", async () => {
  const now = 1_800_000_000;
  const token = "test-only-token";
  const valid = await signedInitData(token, now - 10, { id: 42 });
  assert.equal((await validateEitaaInitData(valid.replace("42", "43"), token, { now })).ok, false);
  const stale = await signedInitData(token, now - 301, { id: 42 });
  assert.deepEqual(await validateEitaaInitData(stale, token, { now }), { ok: false, reason: "stale_auth" });
  assert.deepEqual(await validateEitaaInitData("", token, { now }), { ok: false, reason: "missing_input" });
});
