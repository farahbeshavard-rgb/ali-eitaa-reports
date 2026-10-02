# Ali Eitaa Reports — secure backend scaffold

Status: SCAFFOLD ONLY / NOT DEPLOYED / NO REAL SEND.

The backend must:
1. accept raw Eitaa WebApp initData over HTTPS;
2. validate its signed hash server-side using the Eitaa application token stored only as a secret;
3. enforce freshness using auth_date;
4. create/resolve a recipient binding only through an opaque one-time onboarding nonce;
5. never accept customer_id from the browser as authority;
6. fail closed on mismatch/replay/expired nonce;
7. expose no token or other customers' data;
8. require Generate → Validate → Preview → PO Confirmation → Authorized Sender Check → Send → Result → Audit.

Before production:
- rotate the previously exposed Eitaa token;
- configure the new token as a server-side secret;
- use private durable storage for Recipient Registry, onboarding nonce hashes and append-only audit;
- test whether validated WebApp user.id is accepted by EitaaYar sendMessage as a private-person chat_id after the required Start/opt-in. Do not assume equivalence until proven;
- never interpret API success as read/delivery proof without separate evidence.

This folder intentionally contains no credentials.
