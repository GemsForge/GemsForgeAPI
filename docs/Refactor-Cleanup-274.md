# Cleanup summary — #274

## Consolidated

- API routes share `requireRouteRecord` for identifier parsing, record lookup,
  and consistent not-found handling. Route handlers keep their own service and
  response behavior.
- `PropertyPatchValidation` centralizes empty-payload, allowlist, and
  omission/null checks while each resource owns its editable-field allowlist
  and mapping.
- Schema changes share `VerifiedSchemaChangeExecutor` for backup, apply, and
  verification mechanics. `ApprovedSchemaChangeService` and
  `UserTableCreationService` retain their distinct authorization and
  precondition rules.
- Console field rendering, scalar editing, and safe query feedback use shared
  components. See [Console cleanup details](Console-Refactor-276.md).

## Intentionally kept specific

- Resource routes retain their own request/response contracts and business
  validation; a generic route layer would hide meaningful differences.
- Schema-change callers keep separate approval, preview, and verification
  policies even though the execution lifecycle is shared.
- Console features retain resource-specific field definitions and payload
  mappings. Attachment ownership workflows and ForgeKeeper's relationship-
  aware editor also remain specialized because their behavior differs from
  scalar edits.
