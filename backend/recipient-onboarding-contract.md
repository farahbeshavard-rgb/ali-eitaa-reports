# Recipient Onboarding Contract v0.1

Status: APPROVED DESIGN CANDIDATE / NOT DEPLOYED / NO REAL SEND

## Goal
Remove all per-customer manual chat-id work from the operator workflow while preserving Eitaa opt-in and fail-closed identity binding.

## One-time customer flow
1. Backend creates an opaque, random, single-use onboarding nonce linked server-side to exactly one internal customer reference.
2. Customer receives a business-approved onboarding link. The link contains no financial data, phone number, customer name, transaction data, or Eitaa token.
3. Customer opens the Eitaa program and grants the provider-required send permission (Start/direct-link flow).
4. WebApp sends raw signed Eitaa initData plus the opaque nonce to the backend over HTTPS.
5. Backend validates the initData signature and auth_date using the application token stored only as a deployment secret.
6. Backend atomically validates and consumes the nonce.
7. Backend records validated Eitaa user.id as an identity attribute only.
8. The binding remains IDENTITY_VALIDATED, not ACTIVE, until the private-message chat_id relationship is separately proven by a controlled provider test.
9. After proof, backend stores the verified recipient chat_id and activates the binding.
10. Subsequent reports use the stored verified binding; the operator does not repeat onboarding.

## Hard security rules
- Browser-supplied customer_id is never authoritative.
- initDataUnsafe is display-only and never authorizes binding or sending.
- user.id is NOT assumed to equal sendMessage chat_id until controlled test evidence proves it.
- Nonce is single-use, expires quickly, and only its hash is stored.
- Reuse, expiry, identity mismatch, missing signature, stale auth_date, or recipient ambiguity => BLOCKED.
- No Eitaa token, Excel data, financial balances, report bodies, customer phone numbers, or private recipient IDs are committed to the public repository.
- Recipient revocation/rebinding creates append-only audit events.
- No automatic send. Every report requires immutable preview + Product Owner confirmation + sender verification.
- Provider API success means provider acceptance only, not human read/delivery proof.

## Operator experience
Normal customer: one-time opt-in/onboarding.
Operator: no manual profile inspection, no manual chat-id lookup, no per-customer WebApp debugging.
