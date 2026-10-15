# Database migrations

For the current live-database workflow, including backup, confirmation,
schema reconciliation, and recovery, see docs/Workflow-Operations.md.

This project uses Fluent migrations to create and change the SQLite database
schema in a controlled, repeatable way.

## What is a migration?

A migration is Swift code that describes one database schema change. It has two
parts:

- `prepare` applies the change, such as creating a table or adding a column.
- `revert` reverses the change, such as deleting the table or removing a column.

The model describes how Swift reads and writes records. The migration describes
how the corresponding database table is created. Both sides need to agree on
table names and column names.

The migrations in this repository mirror the existing Gem Life tables for
isolated tests and disposable local development databases. They are not
startup instructions for the real Gem Life database. Migrations change schema;
services read and change records in an already-existing schema.

The local database console can create a new SQLite file and apply the approved
`gem-life-development` profile. It does not run migrations against the
personal database selected by `DATABASE_PATH`. This keeps schema creation
explicit and prevents the API from changing the existing Gem Life data store
on startup.

## Why the order matters

The Gem Life taxonomy is hierarchical:

```text
domains
    └── forgekeeper
            └── parent/child pages
```

The child tables contain foreign keys to their parent tables. Therefore the
core migrations are registered in this order:

1. `CreateDomains`
2. `CreateForgeKeeper`

Fluent runs `revert` in the opposite order so child tables are removed before
their parent tables.

The full local development profile currently applies these migrations in order:

```text
CreateAddresses
CreateDomains
CreateEducation
CreateEmployment
CreateBudgetCategories
CreateBudgetSubcategories
CreateExpenseTransactions
CreateEmojiLabelDefinitions
CreateFileMetadata
CreateServiceAccounts
CreateServiceLogoAssets
CreateForgeKeeper
CreateGemHues
CreateGemHueImages
```

This profile is a test/development schema assembled from the repository's
isolated migrations. It is intentionally different from connecting to the
existing personal database: creating a new local file may prepare tables,
while normal API startup must preserve the existing database baseline.

## What the schema builder means

```swift
database.schema("domains")
    .field("name", .string, .required)
    .create()
```

- `schema("domains")` selects the table being defined.
- `field` adds a column.
- `.string` is the database type.
- `.required` means the column cannot be `NULL`.
- `.create()` applies the table definition.

The migration files are located in `Sources/Migrations/` and are registered by
the test application setup. The production-style application connects to the
existing database through `DATABASE_PATH` without running these migrations.
Each schema change should use a focused migration rather than editing an older
migration that may already have run elsewhere.
