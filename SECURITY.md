# Security

This public repository contains no Eitaa API token, customer financial data, Excel files, recipient IDs, or production secrets.

## Hard rules
- Never commit Eitaa/EitaaYar tokens.
- Never commit customer or financial data.
- Validate Eitaa WebApp `initData` server-side before trusting identity.
- Fail closed when identity or recipient binding cannot be verified.
- Sending requires preview, Product Owner confirmation, sender authorization, result logging, and audit.
- Recipient Registry belongs in private backend storage, not GitHub Pages.
