# Gem Life React testing console

This is the React + TypeScript replacement for the original local browser
prototype. It is a developer testing interface for the private Vapor API, not
the official Gem Life product UI.

## Start the API

From the repository root:

```bash
DATABASE_PATH="/absolute/path/to/GemLife_DB_rebuild.sqlite" \
swift run GemsForgeAPI serve --hostname 127.0.0.1 --port 8081
```

## Start the React console

In a second terminal:

```bash
cd Console
VITE_API_TARGET="http://127.0.0.1:8081" npm run dev
```

Open `http://127.0.0.1:5173/`.

Vite proxies API paths to Vapor so the browser can use same-origin requests:

```text
/domains
/forgekeeper
/gemhues
/education
/employment
/addresses
/transactions
/health
/schema-builder
/live-database
```

## Structure

```text
src/
├── api.ts                         typed API client
├── types.ts                       API response and request types
├── components/                    shared UI components
└── features/
    ├── domains/                   stable domain navigation
    ├── forgekeeper/               page reads and PATCH testing
    ├── gem-hues/                  hue reads and image previews
    ├── education/                 Life-area education reads
    ├── employment/                Life-area employment reads
    ├── addresses/                 Life-area address reads
    └── transactions/              Life-area expense transaction reads
```

The console currently preserves the prototype's styling and behavior while
separating API access and feature UI into maintainable modules.

## Design system

Tamagui is configured in `src/design-system/tamagui.config.ts`. The existing
Gem Life palette is registered as shared color tokens so reusable components
can consume the same visual language without copying literal color values.
The provider is mounted at the application entry point; feature components
will migrate to Tamagui primitives in focused follow-up issues.

Shared primitives live in `src/components/ui`. Feature views should compose
these primitives instead of repeating buttons, cards, and labelled fields.

## Schema builder

The Developer → Build & Import view is a local testing workflow for creating a
new table in the configured database. Enter an UpperCamelCase table name, add
at least one property, choose its SQLite type, and use **Add property** for
additional columns. The API supplies the required unique `TEXT` `ID` primary
key; the UI never asks the user to define it.

The flow previews the generated definition before execution. Execution requires
the API environment variables `DATABASE_PATH` and
`LIVE_DATABASE_BACKUP_DIRECTORY`, because the API creates a backup before
changing the database. Duplicate table names are reported in the builder and
require choosing a different name.

The console is intentionally a local testing client, not the official Gem Life
product UI. It currently exposes read workflows for existing data and the
ForgeKeeper PATCH workflow. It is not an authorization boundary or a
replacement for API tests.

## Build

```bash
npm run build
```
