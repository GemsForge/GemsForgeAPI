# Local testing console

The local testing console is a browser interface for exercising the API without
using the terminal or a database client. The original prototype is served by
Vapor from `Public/`. The current implementation is a separate React +
TypeScript application under `Console/` and is intended for local development
only.

## Start it

Configure `DATABASE_PATH`, then run the API from the repository directory:

```bash
export DATABASE_PATH="/absolute/path/to/GemLife_DB_rebuild.sqlite"
swift run GemsForgeAPI serve --hostname 127.0.0.1 --port 8080
```

Open `http://127.0.0.1:8080/` in a browser.

If Xcode already has an API instance on port `8080`, use a temporary port:

```bash
DATABASE_PATH="/absolute/path/to/GemLife_DB_rebuild.sqlite" \
swift run GemsForgeAPI serve --hostname 127.0.0.1 --port 8081
```

Then open `http://127.0.0.1:8081/`.

## Current capabilities

### React console

Start the Vapor API on port `8081`, then start the React console:

```bash
cd Console
VITE_API_TARGET="http://127.0.0.1:8081" npm run dev
```

Open `http://127.0.0.1:5173/`.

- View the four stable Domains records.
- Select a domain and retrieve its ForgeKeeper pages.
- View all root pages.
- View immediate children of a ForgeKeeper page.
- Open a page editor and exercise the PATCH endpoint.
- See empty-state behavior when a domain has no ForgeKeeper pages.
- Open Gem Hues as Foundation reference data.
- View all 23 Gem Hues with swatches, hex codes, and classifications.
- Select a Gem Hue to retrieve its full record and render its stored image blob.
- Open Education as Life-area data without forcing it into the Domains hierarchy.
- View all 8 Education records returned by `GET /education`.
- Select an Education record to retrieve its details through `GET /education/:id`.
- Open Employment as Life-area data without forcing it into the Domains hierarchy.
- View all five Employment records returned by `GET /employment`.
- Select an Employment record to retrieve its details through `GET /employment/:id`.
- Open Addresses as Life-area data and inspect address records directly.
- Select an address to retrieve its complete details through `GET /addresses/:id`.
- Education and Employment details render their embedded `address` response
  objects instead of displaying address IDs.
- Expense Transactions are available to the API through `GET /transactions`
  and `GET /transactions/:transactionID`. Testing-console support remains a
  separate follow-up under issue #41 so the console can be updated as the
  Expense Tracker feature set grows.

The React project keeps the API client and UI features separate:

```text
Console/src/api.ts                    → typed HTTP requests
Console/src/features/domains/         → domain navigation
Console/src/features/forgekeeper/     → page reads and PATCH testing
Console/src/features/gem-hues/        → hue records and image previews
Console/src/features/education/        → Life-area education reads
Console/src/features/employment/       → Life-area employment reads
Console/src/features/addresses/        → Life-area address reads
Console/src/features/databases/        → isolated local database creation
```

The Gem Hues view exercises all current read services:

```text
GET /gemhues
GET /gemhues/:hueID
GET /gemhues/:hueID/image
```

Gem Hues are displayed as Foundation reference data, but the current database
schema does not yet link `GemHues` directly to `Domains`.

Education is displayed as Life-area data, but the current `Education` table
does not contain a `DomainID` column. The console therefore gives it a separate
Life data navigation item rather than placing it under a selected domain.

The Education view exercises the current read services:

```text
GET /education
GET /education/:educationID
```

Employment is displayed as Life-area data, but the current `Employment` table
does not contain a `DomainID` column. The console therefore gives it a separate
Life data navigation item. Its read view exercises:

```text
GET /employment
GET /employment/:employmentID
```

Employment contact fields are shown only in this local testing console. A
future authenticated product UI should apply an explicit privacy policy before
exposing those fields.

The Addresses view exercises:

```text
GET /addresses
GET /addresses/:addressID
```

The API keeps foreign-key IDs in database models and write payloads, but
expands the relationship into an `address` object in Education and Employment
read responses. This lets the console render related locations without a
second lookup request.

The Expense Tracker view exercises the existing Transactions table through:

```text
GET /transactions
GET /transactions/:transactionID
```

The console renders the transaction item, date, stable ID, amount, category and
subcategory IDs, receipt and merchant references, quantity, price fields, and
notes. It is intentionally read-only in this slice; write controls remain
outside the testing-console issue until the API contracts are reviewed.

### Local Databases

The Developer → Local Databases view provides a guarded way to create a new
SQLite database for development and testing. It is disabled unless the API
environment explicitly enables it and points to an existing safe directory.

The view calls:

```text
GET /local-databases/capabilities
POST /local-databases
```

The capability response previews the approved migration profile and safety
rules. Creating a database requires explicit confirmation in the console. The
browser submits only a simple filename and profile; filesystem paths stay on
the API host. The personal database is not a creation target, and existing
files cannot be replaced. See [`Local-Database-Creation.md`](Local-Database-Creation.md)
for environment setup and the complete migration list.

### Live Schema

Live Schema is the read-only first step toward managing tables in the existing
Gem Life database. Its API endpoint is:

```text
GET /live-database/schema
```

The endpoint reports application tables, columns, primary keys, foreign keys,
and indexes without changing the database or exposing its absolute path. The
React display is available under **Developer → Live Schema**. Select a table
to inspect its columns, primary keys, relationships, and indexes. This is
still read-only; migration preview and live changes remain separate follow-up
issues. See [`Live-Schema-Inspection.md`](Live-Schema-Inspection.md).

## Notes import status

The Notes upload area is intentionally a visual placeholder. The current API
does not expose a ForgeKeeper create/import endpoint, and the existing database
currently contains no ForgeKeeper records. Defining the Notes export format,
validation rules, duplicate behavior, and create workflow should be a separate
issue before the upload control is connected.

## Layer placement

```text
Console/src/                             → React testing interface
Public/                                  → original local prototype
Routes                                   → HTTP behavior
Services                                 → database queries and updates
Models                                   → existing table mappings
```

The console uses same-origin `fetch` requests, so it does not require CORS or a
second frontend server during local development.
