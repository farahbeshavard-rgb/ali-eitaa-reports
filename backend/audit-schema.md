# Append-only Audit Schema

Status: DESIGN / NOT DEPLOYED

Each event:
- event_id
- report_id
- event_type
- actor_type
- actor_ref
- sender_ref
- recipient_binding_id
- transaction_or_order_ref
- preview_hash
- confirmation_ref
- send_attempt_id
- provider_result_class
- timestamp
- correlation_id

Expected event types:
REPORT_GENERATED
REPORT_VALIDATED
PREVIEW_CREATED
RECIPIENT_VERIFIED
PO_CONFIRMED
SENDER_VERIFIED
SEND_ATTEMPTED
PROVIDER_ACCEPTED
SEND_FAILED
BINDING_CREATED
BINDING_REVOKED

Audit is append-only. Corrections are new events, never destructive edits.
