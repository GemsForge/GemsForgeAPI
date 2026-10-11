# ForgeKeeper integration

ForgeKeeper stores pages inside the Gem Life hierarchy. Each page belongs to a
top-level domain and may optionally point to another ForgeKeeper page through
`ParentID`.

## Existing schema mapping

| Database column | Swift property | Purpose |
| --- | --- | --- |
| `ForgeKeeperID` | `id` | Integer identity of the page. |
| `ParentID` | `parent.id` | Optional immediate parent page. `NULL` identifies a root page. |
| `DomainID` | `domain.id` | Stable top-level domain identifier. |
| `Title` | `title` | Required page title. |
| `Description` | `description` | Page explanation or metadata. |
| `DateCreated` | `createdAt` | Creation timestamp managed by Fluent. |
| `DateUpdated` | `updatedAt` | Last-update timestamp managed by Fluent. |

The existing domain identifiers are `POS`, `FOUNDATION`, `LIFE`, and
`KNOWLEDGE`. The API preserves the database's existing table and column names.

## HTTP endpoints

| Method | Path | Behavior |
| --- | --- | --- |
| `GET` | `/forgekeeper` | Returns all ForgeKeeper pages. |
| `GET` | `/forgekeeper/:id` | Returns one page by ID. |
| `GET` | `/forgekeeper/roots` | Returns pages with no parent. |
| `GET` | `/forgekeeper/:id/children` | Returns the page's immediate children. |
| `GET` | `/domains/:id/forgekeeper` | Returns pages belonging to one domain. |
| `PATCH` | `/forgekeeper/:id` | Partially updates title, description, or parent. |

The PATCH endpoint does not replace the page identity, domain, or creation
timestamp. Parent updates must reference an existing page in the same domain,
and a page cannot be its own parent. Sending `parentID: null` clears the
parent and makes the page a root page.

## Layer responsibilities

```text
ForgeKeeper model  → maps Swift properties to the existing table
ForgeKeeper service → performs reusable database queries
ForgeKeeper routes  → validates HTTP input and returns responses
Route tests         → verify behavior with isolated in-memory SQLite
Migrations          → mirror the schema for tests only
```

The real Gem Life database is treated as an existing baseline. Application
startup registers the SQLite connection but does not register or execute the
test migrations against that file.

## Local configuration

The API requires the `DATABASE_PATH` environment variable. Keep the real value
in the Xcode Scheme or an ignored `.env` file:

```text
DATABASE_PATH=/absolute/path/to/GemLife_DB_rebuild.sqlite
```

The committed `.env.example` contains only a placeholder. Never commit the
real path, database file, or personal data.

## Verification

Run the automated suite with an isolated database:

```bash
swift test
```

For a read-only verification of the real local database, start the API on a
temporary port so it does not conflict with an Xcode instance already using
`8080`:

```bash
DATABASE_PATH=/Users/gemsforge/DBeaver/GemLife_DB_rebuild.sqlite \
swift run GemsForgeAPI serve --hostname 127.0.0.1 --port 8081
```

In another terminal, call only read endpoints:

```bash
curl http://127.0.0.1:8081/health
curl http://127.0.0.1:8081/domains
curl http://127.0.0.1:8081/forgekeeper/roots
```

The verification performed for Issue #23 returned the four existing domains,
an empty root-page list, and no migration or table-recreation attempt.
