import { json, randomToken, requireOperator, sha256, validateEitaaInitData } from "./security.js";
import { renderReport, validateReportInput } from "./domain.js";

const now = () => Math.floor(Date.now() / 1000);
const id = prefix => `${prefix}_${crypto.randomUUID()}`;
const q = env => {
  if (!env.DB) throw new Error("database_not_configured");
  return env.DB;
};

function cors(env, request) {
  const origin = request.headers.get("origin") || "";
  const allowed = env.ALLOWED_ORIGIN || "";
  return origin && origin === allowed ? { "access-control-allow-origin": origin, "vary": "origin" } : {};
}

async function body(request) {
  const type = request.headers.get("content-type") || "";
  if (!type.includes("application/json")) throw new Error("json_required");
  return request.json();
}

async function audit(env, event) {
  await q(env).prepare(`INSERT INTO audit_events
    (event_id,report_id,event_type,actor_type,actor_ref,sender_ref,recipient_binding_id,
     transaction_or_order_ref,preview_hash,confirmation_ref,send_attempt_id,
     provider_result_class,correlation_id,details_json,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(
      id("evt"), event.report_id || null, event.event_type, event.actor_type || "SYSTEM",
      event.actor_ref || null, event.sender_ref || null, event.recipient_binding_id || null,
      event.subject_ref || null, event.preview_hash || null, event.confirmation_ref || null,
      event.send_attempt_id || null, event.provider_result_class || null,
      event.correlation_id || id("corr"), JSON.stringify(event.details || {}), now()
    ).run();
}

async function createNonce(request, env) {
  if (!requireOperator(request, env)) return json({ ok: false, error: "unauthorized" }, 401);
  const data = await body(request);
  if (!data.internal_customer_ref) return json({ ok: false, error: "missing_customer_ref" }, 400);
  const nonce = randomToken(32);
  const hash = await sha256(nonce);
  const expires = now() + 600;
  await q(env).prepare(`INSERT INTO onboarding_nonces
    (nonce_hash,internal_customer_ref,expires_at,created_at) VALUES (?,?,?,?)`)
    .bind(hash, String(data.internal_customer_ref), expires, now()).run();
  await audit(env, { event_type: "ONBOARDING_CREATED", actor_type: "OPERATOR", details: { expires_at: expires } });
  const username = env.APP_PUBLIC_USERNAME || "";
  return json({ ok: true, nonce, expires_at: expires, onboarding_url: username ? `https://eitaa.com/${username}?startapp=${nonce}` : null }, 201);
}

async function completeOnboarding(request, env) {
  const data = await body(request);
  const validation = await validateEitaaInitData(data.init_data, env.EITAA_APP_TOKEN, { maxAgeSeconds: 300 });
  if (!validation.ok) return json({ ok: false, error: validation.reason }, 401);
  if (!data.nonce) return json({ ok: false, error: "missing_nonce" }, 400);
  const hash = await sha256(data.nonce);
  const nonceRow = await q(env).prepare(`SELECT internal_customer_ref,expires_at,consumed_at
    FROM onboarding_nonces WHERE nonce_hash=?`).bind(hash).first();
  if (!nonceRow || nonceRow.consumed_at || nonceRow.expires_at < now()) {
    return json({ ok: false, error: "nonce_invalid_expired_or_replayed" }, 409);
  }
  const bindingId = id("bind");
  const timestamp = now();
  const statements = [
    q(env).prepare(`UPDATE onboarding_nonces SET consumed_at=?
      WHERE nonce_hash=? AND consumed_at IS NULL AND expires_at>=?`).bind(timestamp, hash, timestamp),
    q(env).prepare(`INSERT INTO recipient_bindings
      (binding_id,internal_customer_ref,eitaa_user_id,eitaa_chat_id,verification_status,
       consent_at,bound_at,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?)`).bind(bindingId, nonceRow.internal_customer_ref,
        validation.user.id, null, "IDENTITY_VALIDATED", timestamp, timestamp, timestamp, timestamp)
  ];
  await q(env).batch(statements);
  await audit(env, { event_type: "BINDING_CREATED", actor_type: "EITAA_USER", actor_ref: validation.user.id, recipient_binding_id: bindingId });
  return json({ ok: true, binding_id: bindingId, status: "IDENTITY_VALIDATED", send_eligible: false }, 201);
}

async function verifyRecipient(request, env, bindingId) {
  if (!requireOperator(request, env)) return json({ ok: false, error: "unauthorized" }, 401);
  const data = await body(request);
  if (!data.verified_chat_id || !data.proof_ref || data.confirmed_user_id_match !== true) {
    return json({ ok: false, error: "controlled_proof_required" }, 400);
  }
  const binding = await q(env).prepare(`SELECT binding_id,eitaa_user_id,verification_status
    FROM recipient_bindings WHERE binding_id=?`).bind(bindingId).first();
  if (!binding || binding.verification_status !== "IDENTITY_VALIDATED") {
    return json({ ok: false, error: "binding_not_verifiable" }, 409);
  }
  const timestamp = now();
  await q(env).prepare(`UPDATE recipient_bindings SET eitaa_chat_id=?,verification_status='ACTIVE',
    proof_ref=?,updated_at=? WHERE binding_id=? AND verification_status='IDENTITY_VALIDATED'`)
    .bind(String(data.verified_chat_id), String(data.proof_ref), timestamp, bindingId).run();
  await audit(env, { event_type: "RECIPIENT_VERIFIED", actor_type: "PRODUCT_OWNER", actor_ref: data.confirmed_by || "PO", recipient_binding_id: bindingId, details: { proof_ref: String(data.proof_ref) } });
  return json({ ok: true, binding_id: bindingId, status: "ACTIVE", send_eligible: true });
}

async function revokeRecipient(request, env, bindingId) {
  if (!requireOperator(request, env)) return json({ ok: false, error: "unauthorized" }, 401);
  const data = await body(request);
  if (!data.reason || !data.confirmed_by) return json({ ok: false, error: "revocation_evidence_required" }, 400);
  const timestamp = now();
  const result = await q(env).prepare(`UPDATE recipient_bindings SET verification_status='REVOKED',
    revoked_at=?,updated_at=? WHERE binding_id=? AND verification_status!='REVOKED'`)
    .bind(timestamp, timestamp, bindingId).run();
  if (!result.meta?.changes) return json({ ok: false, error: "binding_not_revocable" }, 409);
  await audit(env, { event_type: "BINDING_REVOKED", actor_type: "PRODUCT_OWNER", actor_ref: String(data.confirmed_by), recipient_binding_id: bindingId, details: { reason: String(data.reason) } });
  return json({ ok: true, binding_id: bindingId, status: "REVOKED", send_eligible: false });
}

async function createPreview(request, env) {
  if (!requireOperator(request, env)) return json({ ok: false, error: "unauthorized" }, 401);
  const data = await body(request);
  const checked = validateReportInput(data);
  if (!checked.ok) return json({ ok: false, error: checked.reason }, 400);
  const binding = await q(env).prepare(`SELECT binding_id,verification_status FROM recipient_bindings WHERE binding_id=?`)
    .bind(data.recipient_binding_id).first();
  if (!binding || binding.verification_status === "REVOKED" || binding.verification_status === "BLOCKED") {
    return json({ ok: false, error: "recipient_not_eligible" }, 409);
  }
  const preview = renderReport(data);
  const previewHash = await sha256(preview);
  const reportId = id("rpt");
  const timestamp = now();
  await q(env).prepare(`INSERT INTO reports
    (report_id,report_type,subject_ref,recipient_binding_id,source_refs_json,payload_json,
     preview_text,preview_hash,version,status,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).bind(reportId, data.report_type, String(data.subject_ref),
      data.recipient_binding_id, JSON.stringify(data.source_refs), JSON.stringify(data.payload),
      preview, previewHash, 1, "PREVIEWED", timestamp, timestamp).run();
  await audit(env, { report_id: reportId, event_type: "PREVIEW_CREATED", actor_type: "OPERATOR", recipient_binding_id: data.recipient_binding_id, subject_ref: data.subject_ref, preview_hash: previewHash });
  return json({ ok: true, report_id: reportId, version: 1, preview_hash: previewHash, preview, send_status: "NOT_SENT" }, 201);
}

async function confirmPreview(request, env, reportId) {
  if (!requireOperator(request, env)) return json({ ok: false, error: "unauthorized" }, 401);
  const data = await body(request);
  const report = await q(env).prepare(`SELECT report_id,preview_hash,status FROM reports WHERE report_id=?`).bind(reportId).first();
  if (!report || report.status !== "PREVIEWED") return json({ ok: false, error: "report_not_confirmable" }, 409);
  if (!data.preview_hash || data.preview_hash !== report.preview_hash || !data.confirmed_by) {
    return json({ ok: false, error: "confirmation_snapshot_mismatch" }, 409);
  }
  const timestamp = now();
  await q(env).prepare(`UPDATE reports SET status='CONFIRMED',confirmed_by=?,confirmed_at=?,updated_at=?
    WHERE report_id=? AND status='PREVIEWED' AND preview_hash=?`).bind(String(data.confirmed_by), timestamp, timestamp, reportId, report.preview_hash).run();
  await audit(env, { report_id: reportId, event_type: "PO_CONFIRMED", actor_type: "PRODUCT_OWNER", actor_ref: String(data.confirmed_by), preview_hash: report.preview_hash, confirmation_ref: `${reportId}:${timestamp}` });
  return json({ ok: true, report_id: reportId, status: "CONFIRMED", send_status: "NOT_SENT" });
}

async function sendReport(request, env, reportId) {
  if (!requireOperator(request, env)) return json({ ok: false, error: "unauthorized" }, 401);
  if (env.SEND_ENABLED !== "true") return json({ ok: false, error: "send_disabled" }, 423);
  if (!env.EITAA_APP_TOKEN || !env.TOKEN_ROTATED_AT) return json({ ok: false, error: "rotated_secret_not_configured" }, 503);
  if (!env.APP_PUBLIC_USERNAME || !env.APPROVED_APP_USERNAME || env.APP_PUBLIC_USERNAME !== env.APPROVED_APP_USERNAME) {
    return json({ ok: false, error: "authorized_sender_not_verified" }, 409);
  }
  const data = await body(request);
  if (!data.idempotency_key) return json({ ok: false, error: "missing_idempotency_key" }, 400);
  const report = await q(env).prepare(`SELECT r.*,b.eitaa_chat_id,b.verification_status
    FROM reports r JOIN recipient_bindings b ON b.binding_id=r.recipient_binding_id
    WHERE r.report_id=?`).bind(reportId).first();
  if (!report || report.status !== "CONFIRMED" || report.verification_status !== "ACTIVE" || !report.eitaa_chat_id) {
    return json({ ok: false, error: "send_gate_blocked" }, 409);
  }
  const existing = await q(env).prepare(`SELECT provider_result_class FROM send_attempts WHERE idempotency_key=?`).bind(data.idempotency_key).first();
  if (existing) return json({ ok: true, duplicate_prevented: true, provider_result_class: existing.provider_result_class });
  const attemptId = id("send");
  const response = await fetch("https://eitaayar.ir/api/app/sendMessage", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token: env.EITAA_APP_TOKEN, chat_id: report.eitaa_chat_id, text: report.preview_text })
  });
  let provider;
  try { provider = await response.json(); } catch { provider = { ok: false }; }
  const result = response.ok && provider.ok === true ? "PROVIDER_ACCEPTED" : "SEND_FAILED";
  await q(env).batch([
    q(env).prepare(`INSERT INTO send_attempts
      (send_attempt_id,report_id,idempotency_key,preview_hash,provider_result_class,provider_response_code,created_at)
      VALUES (?,?,?,?,?,?,?)`).bind(attemptId, reportId, data.idempotency_key, report.preview_hash, result, response.status, now()),
    q(env).prepare(`UPDATE reports SET status=?,updated_at=? WHERE report_id=? AND preview_hash=?`)
      .bind(result, now(), reportId, report.preview_hash)
  ]);
  await audit(env, { report_id: reportId, event_type: result, actor_type: "SYSTEM", sender_ref: env.AUTHORIZED_SENDER_REF, recipient_binding_id: report.recipient_binding_id, preview_hash: report.preview_hash, send_attempt_id: attemptId, provider_result_class: result });
  return json({ ok: result === "PROVIDER_ACCEPTED", report_id: reportId, result, delivery_status: "UNKNOWN" }, result === "PROVIDER_ACCEPTED" ? 200 : 502);
}

export default {
  async fetch(request, env) {
    const headers = cors(env, request);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { ...headers, "access-control-allow-methods": "GET,POST", "access-control-allow-headers": "authorization,content-type" } });
    try {
      const url = new URL(request.url);
      if (url.pathname.startsWith("/v1/") && env.API_RATE_LIMITER) {
        const key = request.headers.get("authorization") || url.pathname;
        const limited = await env.API_RATE_LIMITER.limit({ key: await sha256(key) });
        if (!limited.success) return json({ ok: false, error: "rate_limited" }, 429, headers);
      }
      if (request.method === "GET" && url.pathname === "/health") return json({ ok: true, service: "ali-eitaa-reports", send_enabled: env.SEND_ENABLED === "true" }, 200, headers);
      if (request.method === "POST" && url.pathname === "/v1/onboarding/nonces") return createNonce(request, env);
      if (request.method === "POST" && url.pathname === "/v1/onboarding/complete") return completeOnboarding(request, env);
      let match = url.pathname.match(/^\/v1\/recipients\/([^/]+)\/verify$/);
      if (request.method === "POST" && match) return verifyRecipient(request, env, match[1]);
      match = url.pathname.match(/^\/v1\/recipients\/([^/]+)\/revoke$/);
      if (request.method === "POST" && match) return revokeRecipient(request, env, match[1]);
      if (request.method === "POST" && url.pathname === "/v1/reports/preview") return createPreview(request, env);
      match = url.pathname.match(/^\/v1\/reports\/([^/]+)\/confirm$/);
      if (request.method === "POST" && match) return confirmPreview(request, env, match[1]);
      match = url.pathname.match(/^\/v1\/reports\/([^/]+)\/send$/);
      if (request.method === "POST" && match) return sendReport(request, env, match[1]);
      return json({ ok: false, error: "not_found" }, 404, headers);
    } catch (error) {
      const safe = ["json_required", "database_not_configured"].includes(error.message) ? error.message : "internal_error";
      return json({ ok: false, error: safe }, safe === "json_required" ? 415 : 500, headers);
    }
  }
};
