# Recipient Registry — security contract

Status: DESIGN BASELINE / NOT DEPLOYED

## Binding model
A recipient binding is created only after:
1. backend creates a cryptographically random one-time onboarding nonce;
2. only a hash of the nonce is stored;
3. customer receives the opaque onboarding link through an already-authorized business channel;
4. Eitaa WebApp returns raw initData;
5. backend validates initData signature and freshness;
6. backend atomically consumes the nonce;
7. validated Eitaa identity is bound to the internal customer reference;
8. an append-only audit event is written.

The browser must never be trusted to assert customer_id, recipient_id, authorization, or send permission.

## Minimal fields
- binding_id
- internal_customer_ref
- eitaa_user_id
- eitaa_chat_id (nullable until separately proven)
- verification_status
- consent_at
- bound_at
- revoked_at
- onboarding_nonce_hash
- onboarding_expires_at
- created_at / updated_at

No financial balances, Excel rows, reports, or Eitaa API token belong in this registry.

## State machine
PENDING_ONBOARDING -> IDENTITY_VALIDATED -> RECIPIENT_VERIFIED -> ACTIVE
ACTIVE -> REVOKED
Any mismatch/expiry/replay -> BLOCKED

## Send gate
ACTIVE binding
+ report validated
+ immutable preview snapshot
+ Product Owner confirmation tied to snapshot hash/version
+ authorized sender verified
= send may be attempted.

Any failed condition => SEND BLOCKED.
