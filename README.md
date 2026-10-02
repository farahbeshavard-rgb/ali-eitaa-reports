# Ali Eitaa Reports

Secure, fail-closed reporting integration for Ali Sales Management.

## Current status

- GitHub Pages WebApp: onboarding client prepared; backend URL intentionally unset.
- Cloudflare Workers + D1 backend: implemented locally, not deployed.
- Sending: disabled by default and not tested with a real recipient.
- Secrets: none are committed. The previously exposed Eitaa token must be rotated before deployment/send.

## Safety gates

`GENERATE → VALIDATE → PREVIEW → RECIPIENT CHECK → PO CONFIRMATION → AUTHORIZED SENDER CHECK → SEND → RESULT → AUDIT`

Opening the WebApp never sends a report. `SEND_ENABLED` defaults to `false`.

## Local verification

```text
node --test
node --check backend/src/index.js
```

## Deployment (requires Product Owner account access)

1. Create a Cloudflare Worker and private D1 database.
2. Apply `backend/migrations/0001_initial.sql`.
3. Bind the D1 database as `DB` and configure the optional rate limiter.
4. Enter `OPERATOR_API_KEY` and the newly rotated `EITAA_APP_TOKEN` directly in Cloudflare encrypted Secrets. Never paste them into chat or commit them.
5. Configure `APP_PUBLIC_USERNAME` and `APPROVED_APP_USERNAME` to the same verified EitaaYar application username.
6. Keep `SEND_ENABLED=false` through deployment, onboarding, preview, and recipient proof.
7. Set the deployed HTTPS API base in the non-secret `ali-api-base` meta tag only after the health/security checks pass.
8. Enable sending only immediately before a separately confirmed controlled test.

Cloudflare account login, resource creation, secret entry, and first real test send require Product Owner participation/confirmation.
