# Database synchronization audit — #306

This read-only audit is the prerequisite for #305. No database files were
modified.

## Confirmed files

| Role | SQLite file |
| --- | --- |
| Main/source database | `/Users/gemsforge/DBeaver/GemLife_DB_rebuild.sqlite` |
| Development target | `/Users/gemsforge/DBeaver/GemLife_DB_dev.sqlite` |
| Fit target | `/Users/gemsforge/DBeaver/GemLife_DB_fit.sqlite` |

The API's current local `.env` points to `GemLife_DB_dev.sqlite`. The approved
source/target flow is:

```text
GemLife_DB_rebuild.sqlite → GemLife_DB_dev.sqlite
GemLife_DB_rebuild.sqlite → GemLife_DB_fit.sqlite
```

## Row-count comparison

| Table | Main | Dev | Fit |
| --- | ---: | ---: | ---: |
| Addresses | 25 | 25 | 25 |
| Domains | 4 | 4 | 4 |
| Education | 8 | 8 | 8 |
| Employment | 5 | 5 | 5 |
| Transactions | 49 | 49 | 49 |
| Services | 57 | 57 | 57 |
| FileMetadata | 65 | 65 | 65 |
| ForgeKeeper | 0 | 0 | 0 |
| GemHues | 23 | 23 | 23 |
| HomeInventory | 0 | 0 | 0 |

The business-record counts currently match for the tables checked, including
the 65 `FileMetadata` rows now present in all three databases. The
preview/backup workflow must still preserve these rows and reconcile file
paths and ownership explicitly rather than blindly replacing them.

## Schema and ownership findings

- Main has legacy tables including `Expenses`, `ImportExpenses`,
  `ImportServices`, and `ImportServiceLogos` that are not present in the
  migrated dev/fit schema.
- Dev has `Accounts`, `AccountIdentities`, `AuthenticationSessions`, and
  `Hubs`; fit does not yet have those authentication tables.
- Dev contains one account with ID `94751B62-601D-4EE4-A9C0-142403E0B9F2` and
  one hub with ID `E6F8137E-C2AC-4C00-A079-6E4272E344FD`.
- All 25 dev address records currently have a null `HubID`, so the API hides
  them from the authenticated local account until ownership is explicitly
  reviewed and assigned.
- Fit's `Addresses` table currently has no `HubID` column, so fit requires the
  authentication/ownership migration before it can be an equivalent protected
  target.

## Recorded decisions and priority gates

1. Treat `GemLife_DB_rebuild.sqlite` as the authoritative source for this
   synchronization story.
2. Preserve the 65 existing dev/fit `FileMetadata` rows and reconcile them
   separately; do not overwrite or blindly copy them from the rebuild source.
3. Apply the authentication and ownership schema to fit before copying data.
4. Review and explicitly assign legacy records to the local hub; synchronization
   must not infer ownership silently.
5. Priority gate: create verified backups and a dry-run plan before any target
   writes.

## Final read-only verification — 2026-10-19

The repository verifier was run against the approved source and both targets:

```text
python3 Scripts/verify-database-sync.py \
  /Users/gemsforge/DBeaver/GemLife_DB_rebuild.sqlite \
  /Users/gemsforge/DBeaver/GemLife_DB_dev.sqlite \
  /Users/gemsforge/DBeaver/GemLife_DB_fit.sqlite
```

The initial verification result was `failed`. The managed row counts and all
65 `FileMetadata` attachment references match across source, dev, and fit, but
ownership was not ready for protected API use.

The FIT schema blocker was then addressed on 2026-10-19. A byte-verified
backup was created at:

```text
/Users/gemsforge/DBeaver/GemLife_DB_fit-before-hub-schema-20261019.sqlite
```

The approved ownership columns were added to FIT without copying or deleting
records. The address ownership assignment was then explicitly applied to both
DEV and FIT after confirming that all address rows belong to the local hub
`E6F8137E-C2AC-4C00-A079-6E4272E344FD`. Fresh backups were created before that
write:

```text
/Users/gemsforge/DBeaver/GemLife_DB_dev-before-address-ownership-20261019.sqlite
/Users/gemsforge/DBeaver/GemLife_DB_fit-before-address-ownership-20261019.sqlite
```

The final read-only verification returned `verified`:

- DEV: 25 of 25 address rows assigned; 0 unowned.
- FIT: 25 of 25 address rows assigned; 0 unowned.

The source database was not modified. The remaining verification step for
#305 is the API smoke test against both target environments.

## Repeatable FIT ownership procedure

The local SQLite edits above are a completed environment repair, not the
deployment mechanism. Future FIT setup must use a repeatable, versioned flow:

```text
verified backup → versioned HubID schema migration → explicit ownership seed
→ row-count and ownership verification → API smoke test
```

The ownership seed must be idempotent, accept the intended `HubID` through
environment configuration, and require an explicit confirmation flag before
writing. It must not hard-code a personal account or hub ID, infer ownership
from the source database, or overwrite production data. The FIT backup must be
retained until verification succeeds. This is the required follow-up before
considering #305 fully complete after merging to `master`.

The repository entry point for this operation is
`Scripts/seed-database-ownership.py`. It accepts only the DEV or FIT database
filename, requires `--hub-id`, `--backup-directory`, and
`--confirm-ownership-seed`, and skips tables that have not received the
ownership schema yet.
