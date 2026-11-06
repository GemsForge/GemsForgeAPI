# Database relationship inventory

This is a read-only schema inventory of `GemLife_DB_dev.sqlite`, inspected on
2026-11-06. `PRAGMA foreign_key_check` reported 10 existing violations: eight
Education references and two Employment references to
`Addresses_AddressTypeLegacy`. No other violations were reported. FIT and PROD
were not inspected. No database records or schema were changed during this
inspection. The API's Fluent SQLite configuration uses the driver's default
foreign-key-enabled connections.

## Foreign keys declared in DEV

### Expense classifications

- `BudgetSubcategories.CategoryID` → `BudgetCategories.CategoryID` is a
  foreign key.
- `Transactions.CategoryID` → `BudgetCategories.CategoryID` is a foreign key.
- The composite foreign key
  `(Transactions.SubcategoryID, Transactions.CategoryID)` →
  `(BudgetSubcategories.SubcategoryID, BudgetSubcategories.CategoryID)`
  ensures a transaction's subcategory belongs to its category.
- `Transactions.MerchantCode` → `Merchants.Code` is a foreign key.
- The API repeats these checks and adds Hub validation and readable errors.

### Address and page relationships

- `Education.LocationAddressID` and `Employment.WorkAddressID` reference
  `Addresses_AddressTypeLegacy.AddressID` through foreign keys. The API also
  checks the address belongs to the authenticated Hub.
- `ForgeKeeper.DomainID` references `Domains.DomainID`, and `ForgeKeeper.ParentID`
  references `ForgeKeeper.ForgeKeeperID`.
- `DigitalEcosystem.ForgeKeeperID` references `ForgeKeeper.ForgeKeeperID`.

### Files and application ownership

- Attachment columns on Addresses, Education, HomeInventory, Services,
  Transactions, GemHueImages, and ServiceLogoAssets reference
  `FileMetadata.FileMetadataID`. Attachment services also validate file type,
  Hub ownership, and owner references.
- Account, Hub, and Table Kit configuration tables use foreign keys for
  ownership and parent/child rows, including `Hubs.AccountID`, Hub-owned
  metadata `HubID` columns, `ViewColumnConfigurations.ViewID`, and
  `ViewQueryConfigurations.ViewID`/`ParentQueryID`.

The DEV schema declares the Category/Subcategory relationship in the database,
and `foreign_key_check` reported no violations for it. API validation is an
additional guard, not the only integrity mechanism. The declared address
foreign keys currently have 10 orphaned references, so those records need a
separate review before any cleanup or migration is considered.

## Server-validated logical metadata

Table Kit relation definitions and view-column settings store table and column
names as metadata. Those names are not physical foreign keys because the
metadata describes existing tables dynamically. The server resolves these
references against the live schema and Hub. The record columns exposed as
relations should still have real database constraints where their schema
allows them.

`Services.LogoKey` still references the legacy `ServiceLogoAssets.LogoKey` in
DEV. Retiring that database link is a separate reviewed migration; the
application no longer uses the legacy logo lookup path.

No other core record relationship enforced only by the server was identified
in this DEV schema snapshot. The audit does not assess business-rule validity
or same-Hub ownership for every row; FIT and PROD have not been inspected.

## Test-schema differences

The isolated migrations are not fully representative of the DEV relationships
listed above:

- `CreateExpenseTransactions` does not define the DEV foreign keys for
  `CategoryID`, the composite Category/Subcategory pair, or `MerchantCode`.
- `CreateEducation` and `CreateEmployment` omit the address foreign keys found
  in DEV.

Their route tests currently exercise API validation without those database
constraints. Aligning these fixtures with the verified DEV schema is follow-up
work; this inventory does not modify the migrations or any database.

## Verification boundary

This snapshot covers declared foreign-key metadata and the result of
`foreign_key_check` in the DEV SQLite file only. Before a migration or release,
inspect the target database independently, check existing rows for violations,
and follow
[`Database-Relationship-Integrity.md`](Database-Relationship-Integrity.md).
