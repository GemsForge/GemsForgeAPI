# Gem Life React testing console

This is the React + TypeScript replacement for the original local browser
prototype. It is a developer testing interface for the private Vapor API, not
the official Gem Life product UI.

## Start the API

From the repository root:

```bash
DATABASE_PATH="/Users/gemsforge/DBeaver/GemLife_DB_rebuild.sqlite" \
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
    └── gem-hues/                  hue reads and image previews
```

The console currently preserves the prototype's styling and behavior while
separating API access and feature UI into maintainable modules.

## Build

```bash
npm run build
```
