PRAGMA foreign_keys = ON;

CREATE TABLE onboarding_nonces (
  nonce_hash TEXT PRIMARY KEY,
  internal_customer_ref TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  consumed_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE recipient_bindings (
  binding_id TEXT PRIMARY KEY,
  internal_customer_ref TEXT NOT NULL,
  eitaa_user_id TEXT NOT NULL,
  eitaa_chat_id TEXT,
  verification_status TEXT NOT NULL CHECK (verification_status IN
    ('IDENTITY_VALIDATED','RECIPIENT_VERIFIED','ACTIVE','REVOKED','BLOCKED')),
  consent_at INTEGER NOT NULL,
  bound_at INTEGER NOT NULL,
  revoked_at INTEGER,
  proof_ref TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX recipient_active_customer
ON recipient_bindings(internal_customer_ref)
WHERE verification_status != 'REVOKED';

CREATE TABLE reports (
  report_id TEXT PRIMARY KEY,
  report_type TEXT NOT NULL,
  subject_ref TEXT NOT NULL,
  recipient_binding_id TEXT NOT NULL,
  source_refs_json TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  preview_text TEXT NOT NULL,
  preview_hash TEXT NOT NULL,
  version INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN
    ('PREVIEWED','CONFIRMED','SEND_BLOCKED','PROVIDER_ACCEPTED','SEND_FAILED')),
  confirmed_by TEXT,
  confirmed_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY(recipient_binding_id) REFERENCES recipient_bindings(binding_id)
);

CREATE TABLE send_attempts (
  send_attempt_id TEXT PRIMARY KEY,
  report_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  preview_hash TEXT NOT NULL,
  provider_result_class TEXT NOT NULL,
  provider_response_code INTEGER,
  created_at INTEGER NOT NULL,
  FOREIGN KEY(report_id) REFERENCES reports(report_id)
);

CREATE TABLE audit_events (
  event_id TEXT PRIMARY KEY,
  report_id TEXT,
  event_type TEXT NOT NULL,
  actor_type TEXT NOT NULL,
  actor_ref TEXT,
  sender_ref TEXT,
  recipient_binding_id TEXT,
  transaction_or_order_ref TEXT,
  preview_hash TEXT,
  confirmation_ref TEXT,
  send_attempt_id TEXT,
  provider_result_class TEXT,
  correlation_id TEXT NOT NULL,
  details_json TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TRIGGER audit_events_no_update
BEFORE UPDATE ON audit_events BEGIN SELECT RAISE(ABORT, 'audit_is_append_only'); END;
CREATE TRIGGER audit_events_no_delete
BEFORE DELETE ON audit_events BEGIN SELECT RAISE(ABORT, 'audit_is_append_only'); END;
