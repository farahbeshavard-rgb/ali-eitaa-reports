# Send Policy

Status: SECURITY POLICY / NO REAL SEND IMPLEMENTED

Required sequence:
GENERATE -> VALIDATE -> PREVIEW -> RECIPIENT CHECK -> PRODUCT OWNER CONFIRMATION -> AUTHORIZED SENDER CHECK -> SEND -> VERIFY RESULT -> AUDIT

Hard rules:
- No automatic sending.
- No bulk access to Excel or customer database from Eitaa.
- Send only the minimum approved message body.
- Each report is transaction/order scoped.
- Never offset unrelated transactions.
- Missing source data must remain "اطلاعات ثبت نشده"; no AI guessing.
- Confirmation is invalid if preview content changes after confirmation.
- API acceptance is not proof that a human read the message.
- Retry must be idempotent and must not create duplicate sends.
- Sender/recipient ambiguity => fail closed.
