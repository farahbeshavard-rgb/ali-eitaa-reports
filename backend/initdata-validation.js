// Reference implementation for server-side Eitaa WebApp initData validation.
// No secrets are embedded. Supply EITAA_APP_TOKEN from the deployment secret store.

const enc = new TextEncoder();

function bytesToHex(bytes) {
  return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
}
function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
async function hmac(keyBytes, message) {
  const key = await crypto.subtle.importKey(
    "raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(message)));
}

export async function validateEitaaInitData(initData, token, maxAgeSeconds = 300) {
  if (!initData || !token) return { ok: false, reason: "missing_input" };

  const p = new URLSearchParams(initData);
  const receivedHash = p.get("hash") || "";
  p.delete("hash");
  if (!receivedHash) return { ok: false, reason: "missing_hash" };

  const pairs = [];
  for (const [k, v] of p.entries()) pairs.push(`${k}=${v}`);
  pairs.sort();
  const dataCheckString = pairs.join("\n");

  // Eitaa official algorithm:
  // secret_key = HMAC_SHA256(key="WebAppData", message=token)
  // calculated = HMAC_SHA256(key=secret_key, message=data_check_string)
  const secretKey = await hmac(enc.encode("WebAppData"), token);
  const calculated = bytesToHex(await hmac(secretKey, dataCheckString));
  if (!constantTimeEqual(calculated.toLowerCase(), receivedHash.toLowerCase())) {
    return { ok: false, reason: "invalid_hash" };
  }

  const authDate = Number(p.get("auth_date"));
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(authDate) || authDate <= 0 || Math.abs(now - authDate) > maxAgeSeconds) {
    return { ok: false, reason: "stale_auth" };
  }

  let user = null;
  try { user = JSON.parse(p.get("user") || "null"); } catch {}
  if (!user || !user.id) return { ok: false, reason: "missing_user" };

  return {
    ok: true,
    user: {
      id: String(user.id),
      first_name: user.first_name || "",
      last_name: user.last_name || "",
      language_code: user.language_code || "",
      allows_write_to_pm: Boolean(user.allows_write_to_pm)
    },
    auth_date: authDate
  };
}
