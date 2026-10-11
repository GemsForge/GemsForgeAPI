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
/health
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
    └── addresses/                 Life-area address reads
```

The console currently preserves the prototype's styling and behavior while
separating API access and feature UI into maintainable modules.

The console is intentionally a local testing client, not the official Gem Life
product UI. It currently exposes read workflows for existing data and the
ForgeKeeper PATCH workflow. It is not an authorization boundary or a
replacement for API tests.

## Build

```bash
npm run build
```
