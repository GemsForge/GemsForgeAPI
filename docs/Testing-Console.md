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
