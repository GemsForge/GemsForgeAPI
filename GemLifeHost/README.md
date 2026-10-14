# Gem Life SwiftUI host

This target is the native macOS shell for the Gem Life application. It keeps
SwiftUI responsible for the application window and native lifecycle while the
existing React + TypeScript Console remains responsible for Gem Life screens,
navigation, responsive layout, and API presentation.

## Local development

Start the React Console from `Console/`:

```text
npm run dev
```

Then run the `GemLifeHost` target. It loads `http://localhost:5173/` by
default. Set `GEM_LIFE_CONSOLE_URL` in the host scheme to use another local
URL or a packaged web asset entry point.

The repository-level `Scripts/run-gem-life.sh` launcher starts both the API and
host together. The React Console still needs to be running from `Console/` with
`npm run dev`.

The same launcher is available as `swift run GemLife` when run from the
repository root. It loads the ignored local `.env` file automatically.

## Bridge boundary

`GemLifeBridge.swift` registers one `gemLife` WebKit message handler and
decodes the shared envelope. React uses `Console/src/bridge/index.ts` to send
messages to the host and subscribe to native events. Supported message types
are navigation, file/image requests, local-file results, sharing, session
events, and native errors.

The envelope carries a stable type, an optional request ID, and string payload
fields. Native code must return safe metadata or approved content handles; it
must not expose arbitrary filesystem paths to React.
