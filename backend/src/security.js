const enc = new TextEncoder();

export function json(value, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
      "permissions-policy": "camera=(), microphone=(), geolocation=()",
      ...extraHeaders
    }
  });
}

export function constantTimeEqual(a = "", b = "") {
  const aa = enc.encode(String(a));
  const bb = enc.encode(String(b));
  let diff = aa.length ^ bb.length;
  const length = Math.max(aa.length, bb.length);
  for (let i = 0; i < length; i++) diff |= (aa[i] || 0) ^ (bb[i] || 0);
  return diff === 0;
}

export function requireOperator(request, env) {
  const expected = env.OPERATOR_API_KEY || "";
  const supplied = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  return Boolean(expected) && constantTimeEqual(supplied, expected);
}

export async function sha256(value) {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(String(value))));
  return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
}

export function randomToken(bytes = 32) {
  const data = crypto.getRandomValues(new Uint8Array(bytes));
  return Array.from(data, b => b.toString(16).padStart(2, "0")).join("");
}

async function hmac(keyBytes, message) {
  const key = await crypto.subtle.importKey(
    "raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(message)));
}

function bytesToHex(bytes) {
  return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
}

export async function validateEitaaInitData(initData, token, options = {}) {
  const maxAgeSeconds = options.maxAgeSeconds ?? 300;
  const now = options.now ?? Math.floor(Date.now() / 1000);
  if (!initData || !token) return { ok: false, reason: "missing_input" };
  const params = new URLSearchParams(initData);
  const receivedHash = params.get("hash") || "";
  params.delete("hash");
  if (!receivedHash) return { ok: false, reason: "missing_hash" };
  const pairs = [...params.entries()].map(([k, v]) => `${k}=${v}`).sort();
  const secretKey = await hmac(enc.encode("WebAppData"), token);
  const calculated = bytesToHex(await hmac(secretKey, pairs.join("\n")));
  if (!constantTimeEqual(calculated.toLowerCase(), receivedHash.toLowerCase())) {
    return { ok: false, reason: "invalid_hash" };
  }
  const authDate = Number(params.get("auth_date"));
  if (!Number.isFinite(authDate) || authDate <= 0 || now - authDate < -30 || now - authDate > maxAgeSeconds) {
    return { ok: false, reason: "stale_auth" };
  }
  let user;
  try { user = JSON.parse(params.get("user") || "null"); } catch { return { ok: false, reason: "invalid_user" }; }
  if (!user || user.id === undefined || user.id === null) return { ok: false, reason: "missing_user" };
  return {
    ok: true,
    auth_date: authDate,
    user: {
      id: String(user.id),
      first_name: user.first_name || "",
      last_name: user.last_name || "",
      language_code: user.language_code || "",
      allows_write_to_pm: Boolean(user.allows_write_to_pm)
    }
  };
}
