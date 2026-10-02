# Controlled Deployment Gate

Status: **IMPLEMENTED LOCALLY / NOT DEPLOYED / SEND DISABLED**

## Selected architecture

Cloudflare Workers + private D1 was selected because it provides HTTPS execution, encrypted secrets, private durable relational storage, bindings, optional rate limiting, and database recovery without placing credentials or business data in GitHub Pages.

## Production resources

- Worker: `ali-eitaa-reports-api`
- D1 binding: `DB`
- Rate limiter binding: `API_RATE_LIMITER` (recommended)
- Encrypted secrets: `EITAA_APP_TOKEN`, `OPERATOR_API_KEY`
- Non-secret deployment variables: `APP_PUBLIC_USERNAME`, `APPROVED_APP_USERNAME`, `AUTHORIZED_SENDER_REF`, `ALLOWED_ORIGIN`, `SEND_ENABLED`, `TOKEN_ROTATED_AT`

`TOKEN_ROTATED_AT` is non-secret evidence metadata. It must only be set after the Product Owner has rotated the compromised token and saved the new value directly in the provider Secret Store.

## Required deployment order

1. Product Owner signs in to Cloudflare (or explicitly selects another supported provider).
2. Create D1 and apply `backend/migrations/0001_initial.sql`.
3. Deploy with `SEND_ENABLED=false` and no Eitaa send test.
4. Configure CORS to the exact GitHub Pages origin.
5. Add `OPERATOR_API_KEY` as an encrypted secret.
6. Product Owner rotates the compromised Eitaa token and enters the replacement directly as `EITAA_APP_TOKEN`.
7. Verify health, negative authorization, stale initData, nonce replay, expiry, and audit immutability.
8. Configure the public WebApp API base and perform one controlled onboarding.
9. Prove or disprove `validated user.id → private sendMessage chat_id` without weakening the binding policy.
10. Produce immutable preview and stop for Product Owner confirmation.
11. Only after explicit confirmation, temporarily set `SEND_ENABLED=true` for one idempotent test send.

## Rollback

- Set `SEND_ENABLED=false` immediately.
- Revoke the affected recipient binding.
- Rotate the Eitaa token if exposure is suspected.
- Roll back the Worker deployment; retain append-only audit and D1 Time Travel evidence.
- Do not delete audit rows or reuse consumed onboarding nonces.
