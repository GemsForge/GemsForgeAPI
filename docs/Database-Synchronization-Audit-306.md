# Database synchronization audit — #306

This read-only audit is the prerequisite for #305. No database files were
modified.

## Confirmed files

| Role | SQLite file |
| --- | --- |
| Main/source candidate | `/Users/gemsforge/DBeaver/GemLife_DB.sqlite` |
| Development target | `/Users/gemsforge/DBeaver/GemLife_DB_dev.sqlite` |
| Fit target | `/Users/gemsforge/DBeaver/GemLife_DB_fit.sqlite` |

The API's current local `.env` points to `GemLife_DB_dev.sqlite`, not the main
database. The source designation must be confirmed before synchronization.

## Row-count comparison

| Table | Main | Dev | Fit |
| --- | ---: | ---: | ---: |
| Addresses | 25 | 25 | 25 |
| Domains | 4 | 4 | 4 |
| Education | 8 | 8 | 8 |
| Employment | 5 | 5 | 5 |
| Transactions | 49 | 49 | 49 |
| Services | 57 | 57 | 57 |
| FileMetadata | 0 | 65 | 65 |
| ForgeKeeper | 0 | 0 | 0 |
| GemHues | 23 | 23 | 23 |
| HomeInventory | 0 | 0 | 0 |

The business-record counts currently match for the tables checked. Dev and fit
already contain 65 file-metadata rows that are absent from the main database;
these must not be overwritten or blindly copied during synchronization.

## Schema and ownership findings

- Main has legacy tables including `Expenses`, `ImportExpenses`,
  `ImportServices`, and `ImportServiceLogos` that are not present in the
  migrated dev/fit schema.
- Dev has `Accounts`, `AccountIdentities`, `AuthenticationSessions`, and
  `Hubs`; fit does not yet have those authentication tables.
- Dev contains one account and one hub with ID
  `94751B62-601D-4EE4-A9C0-142403E0B9F2`.
- All 25 dev address records currently have a null `HubID`, so the API hides
  them from the authenticated local account until ownership is explicitly
  reviewed and assigned.
- Fit's `Addresses` table currently has no `HubID` column, so fit requires the
  authentication/ownership migration before it can be an equivalent protected
  target.

## Required next decisions

1. Confirm that `GemLife_DB.sqlite` is the authoritative source.
2. Decide whether the 65 existing dev/fit `FileMetadata` rows are retained,
   replaced, or reconciled separately.
3. Apply the authentication and ownership schema to fit before copying data.
4. Review and explicitly assign legacy records to the local hub; synchronization
   must not infer ownership silently.
5. Create verified backups and a dry-run plan before any target writes.
