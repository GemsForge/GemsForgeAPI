# API authentication and tenant-isolation deployment gate

The API must remain private and must not be advertised as a public or multi-account service until this document's rollout checks pass in the target deployment.

## Authentication and authorization

- `GET /health`, `POST /auth/apple/challenges`, and `POST /auth/apple` are the only unauthenticated API routes. The health response contains no account data.
- All other API requests require a bearer token for a server-side session that is present, unexpired, and not revoked. Account identity and the account's hub are resolved from that session; clients cannot select either value.
- User-owned records and attachment metadata are queried by the resolved hub ID. Legacy records with no hub remain inaccessible until explicitly migrated.
- Administrative database/schema operations and shared domain mutations additionally require `GEM_LIFE_OPERATOR_ACCOUNT_ID` to match the authenticated account ID. These operations fail closed when the setting is missing or empty. Never accept an operator identity from a request body or header.

## Existing database rollout

1. Keep the API private and take a verified backup before applying ownership migrations.
2. Apply the authentication, hub, and nullable ownership-field migrations. These migrations intentionally do not infer ownership from row contents or assign existing records to the first account that signs in.
3. Review the target database and decide explicitly which account owns each historical row before assigning any `HubID`. Do not bulk-assign ambiguous data. The operator-only `GET /operator/hub-ownership/preview` endpoint reports the unowned row count per managed table for the authenticated operator's own hub. Review those counts and the data before calling `POST /operator/hub-ownership/assign` with the returned `expectedUnownedCounts` and the exact confirmation `assign-unowned-records-to-my-hub`. Assignment is transactional and rejects stale previews. It assigns only rows whose `HubID` is null, so it is repeat-safe; verify counts and representative records before and after the operation.
4. Confirm that every record and attachment intended for use has the expected hub, while unassigned rows remain invisible. Exercise account A/account B list, detail, mutation, relationship, and file-download cases.
5. Confirm missing, invalid, expired, and revoked sessions are rejected; confirm the public-route allowlist above is exact; confirm operator endpoints fail closed without the configured operator account.
6. Run `swift build`, `swift test`, and `git diff --check` on the exact release commit. Deploy privately first and only lift the privacy gate after the checks and the operator-reviewed data migration are complete.

## Operator configuration

Set `GEM_LIFE_OPERATOR_ACCOUNT_ID` in the server's secret/environment configuration to the Apple account ID authorized for administrative database/schema endpoints. Do not put it in the client bundle. The value is distinct from the Apple subject and must be read from the server-side account record. If it is unset, protected account resource routes continue to work, but administrative operations and domain writes return forbidden.
