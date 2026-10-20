# Local testing console

The React + TypeScript console under `Console/` is the authenticated browser
interface for exercising the private API. The Vapor-served `Public/` root is
now a guidance page; it does not load protected data anonymously.

For an integrated local run, start `swift run GemLife`; the API uses the
standard local port `8180`, and the Console's Vite proxy reads that port
automatically. The fixed-port commands below are for standalone testing.

## Start it

Configure `DATABASE_PATH`, then run the API from the repository directory:

```bash
export DATABASE_PATH="/absolute/path/to/GemLife_DB_rebuild.sqlite"
swift run GemsForgeAPI serve --hostname 127.0.0.1 --port 8180
```

Open `http://127.0.0.1:8180/` for the guidance page, then use the React
Console at `http://127.0.0.1:4173/` for sign-in and protected records.

The examples use port `8180` for both integrated and standalone API launches.
For a second standalone instance, choose another port explicitly and set
`VITE_API_TARGET` to match:

```bash
DATABASE_PATH="/absolute/path/to/GemLife_DB_rebuild.sqlite" \
swift run GemsForgeAPI serve --hostname 127.0.0.1 --port 8082
```

Then open `http://127.0.0.1:8082/` for the guidance page and set
`VITE_API_TARGET=http://127.0.0.1:8082` for the Console.

Sign-in requires Supabase `VITE_SUPABASE_URL` and
`VITE_SUPABASE_PUBLISHABLE_KEY`, plus API `SUPABASE_URL`,
`SUPABASE_OWNER_SUBJECT`, and `GEM_LIFE_OPERATOR_ACCOUNT_ID`. Keep public
signups disabled. See [`Console-Authentication-299.md`](Console-Authentication-299.md).

## Current capabilities

### React console

Start the Vapor API on port `8180`, then start the React console:

```bash
cd Console
VITE_API_TARGET="http://127.0.0.1:8180" npm run dev
```

Open `http://127.0.0.1:4173/`.

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
- Use the reusable Address attachment control to choose, preview, replace, and
  remove an image through the upload and attachment PATCH endpoints.
- Education and Employment details render their embedded `address` response
  objects instead of displaying address IDs.
- Expense Transactions are available through `GET /transactions` and
  `GET /transactions/:transactionID`, with a reusable receipt-image control for
  upload, preview, replacement, and removal.

### Record collection utilities

The Education, Employment, Addresses, Transactions, and Services views use a
shared `RecordCollection` boundary with the `RecordUtilities` controls. The
controls are scoped to the active collection and update the visible records
without reloading the page.

- Search matches the record ID and the main display fields for the active
  table. Search is case-insensitive and can be cleared with **Clear filters**.
- Sort controls expose the fields relevant to each table and toggle ascending
  or descending order. Dates and numeric amounts are compared as stored values.
- Filters expose readable categorical values, including address status,
  education status, employment status, service status, and transaction
  merchant reference. The **All** option removes the active filter.
- Search, sorting, and filtering compose before pagination. The result summary
  reports the matching count against the total loaded records, and pagination
  operates on that matching result set.

The controls use labelled search inputs, native selects, visible sort direction,
status announcements for result summaries, and a single clear action for the
active query state. When adding a new record collection, keep its form and
empty/error states inside the same collection boundary and add its searchable
fields, sort comparators, and categorical filter options explicitly.

The React project keeps the API client and UI features separate:

```text
Console/src/api.ts                    → typed HTTP requests
Console/src/features/domains/         → domain navigation
Console/src/features/forgekeeper/     → page reads and PATCH testing
Console/src/features/gem-hues/        → hue records and image previews
Console/src/features/education/        → Life-area education reads
Console/src/features/employment/       → Life-area employment reads
Console/src/features/addresses/        → Life-area address reads
Console/src/components/AttachmentControl.tsx → reusable local image workflow
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

Attachment controls use `POST /file-uploads`, `GET
/file-metadata/:id/content`, and owner-specific PATCH routes. The browser never
receives the absolute asset directory.

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

The preview and confirmation contract is documented in
[`Live-Migration-Preview.md`](Live-Migration-Preview.md). It is not yet exposed
as a console control because schema execution still requires the backup and
approved-table workflow.

### Schema Builder

The Developer → Build & Import view creates a new table in the configured live
database through a preview-first workflow. It is intended for local testing
and requires the API to have both `DATABASE_PATH` and
`LIVE_DATABASE_BACKUP_DIRECTORY` configured. The backup directory must already
exist and must be separate from the database file.

The console collects the table name and user-defined property columns. It does
not collect an `ID` column or a primary-key choice. The API owns the stable
identifier and adds a required, unique `TEXT` `ID` primary key to the generated
definition. At least one property is required, table names use UpperCamelCase,
and property names must be unique safe identifiers.

The supported SQLite affinity choices are `ANY`, `BLOB`, `INTEGER`, `NUMERIC`,
`REAL`, and `TEXT`. Defaults are limited to approved SQLite literals, such as
numbers, quoted strings, `NULL`, and `CURRENT_*` values. Review the generated
definition before approving creation.

The workflow uses these endpoints:

```text
GET  /schema-builder/metadata
POST /live-database/tables/preview
POST /live-database/tables/execute
```

Preview does not change the database. Execution creates a backup first and
then creates the table. If the requested table name already exists, the API
makes no change and the console tells the user to choose a different name and
preview again. The API also rejects user-submitted `ID` columns and
client-managed primary keys.

## Notes import status

The Notes upload area is intentionally a visual placeholder. The current API
does not expose a ForgeKeeper create/import endpoint, and the existing database
currently contains no ForgeKeeper records. Defining the Notes export format,
validation rules, duplicate behavior, and create workflow should be a separate
issue before the upload control is connected.

## Layer placement

```text
Console/src/                             → React testing interface
Public/                                  → sign-in guidance page, no API calls
Routes                                   → HTTP behavior
Services                                 → database queries and updates
Models                                   → existing table mappings
```

The Console uses same-origin `fetch` requests through Vite's API proxy, so it
does not require CORS. The API's `/app/` package is the production-base Console;
the development UI runs on the Vite server.

When adding a new API resource, add its path to the proxy allowlist in
`Console/vite.config.ts` as well as registering the API route. For example,
the merchant lookup requires `/merchants` in that list. Without the proxy
entry, the Console receives the Vite application HTML instead of the API JSON,
and dropdowns appear empty even though the API route and database query work.
