# Database migrations

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

The `domains` table includes an optional `notes` field for additional context
that does not belong in the title or description.

## Why the order matters

The Gem Life taxonomy is hierarchical:

```text
domains
    └── forgekeeper
            └── parent/child pages
```

The child tables contain foreign keys to their parent tables. Therefore the
migrations are registered in this order:

1. `CreateDomains`
2. `CreateForgeKeeper`

Fluent runs `revert` in the opposite order so child tables are removed before
their parent tables.

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

The migration files are located in `Sources/Migrations/`. They are registered
in `Sources/DatabaseConfiguration.swift`.
