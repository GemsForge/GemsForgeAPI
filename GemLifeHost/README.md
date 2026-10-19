# Gem Life SwiftUI host

This target is the native macOS shell for the Gem Life application. It keeps
SwiftUI responsible for the application window and native lifecycle while the
existing React + TypeScript Console remains responsible for Gem Life screens,
navigation, responsive layout, and API presentation.

## Production packaging

Run `node Scripts/build-gem-life.mjs` from the repository root. It builds React,
stages its generated output under `GemLifeHost/Resources/Console`, stamps the
Git revision/build time, and builds both Swift executables in release mode.
Generated assets are ignored by Git; the resource folder is copied into the
SwiftPM host bundle. `--assets-only` stages assets without compiling Swift.

Launch with `GEM_LIFE_PRODUCTION=1 swift run GemLife` using your usual ignored
local environment file. The launcher locates the release resource bundle,
starts the API on loopback, waits for readiness, and loads `/app/` in the host.
Vite is not required. This is a local release workflow, not signing/notarization
or an App Store distribution pipeline. The API and its configured database
remain required; no API account authentication is implied.

The API serves the packaged UI at `/app`, keeping API URLs at their existing
root paths. BrowserRouter uses the build's `/app/` base. Hashed `assets/` files
are immutable for one year; HTML is revalidated. Missing assets return 404;
missing bundles return an actionable 503. Traversal/symlink escapes outside the
bundle are rejected. Never point the assets setting at a personal-data folder.
Content policy allows only same-origin scripts/connections and scoped previews.
Rebuild to change the bundle; do not overwrite shipped hashed files in place.

For route tests: `swift test --filter GemLifeAssetRouteTests`. These use temporary
fixture files only and do not connect to the configured personal database.

## Local development

For development, use two terminals. In Terminal 1, from the repository root,
start the API and native host:

```text
swift run GemLife
```

In Terminal 2, start the React Console from `Console/`:

```text
cd Console
npm run dev
```

The native window loads `http://127.0.0.1:5173/`; it will appear blank until
the Console dev server is running. The integrated release launcher passes the
selected API port's `/app/` URL to the host. Set `GEM_LIFE_CONSOLE_URL` in the
host scheme to use another loopback URL. Remote/file URLs are rejected.

The repository-level launcher loads the ignored local `.env` file
automatically. `swift run GemLife` is the convenient command for it and must
be run from the `GemsForgeAPI` repository root, not from `Console/` or another
repository.

## Bridge boundary

`GemLifeBridge.swift` registers one `gemLife` WebKit message handler and
decodes the shared envelope. React uses `Console/src/bridge/index.ts` to send
messages to the host and subscribe to native events. Declared envelope types
include navigation, file/image requests, local-file results, sharing, session
events, and native errors.

The envelope carries a stable type, an optional request ID, and string payload
fields. Native code must return safe metadata or approved content handles; it
must not expose arbitrary filesystem paths to React.

## File and bridge security

The host accepts only an exact configured loopback origin (scheme, host, port).
Remote navigation, subframes, file URLs, and credentials in URLs are rejected.
Each bridge request must originate in the trusted main frame and match the
current web view origin. Request bodies are capped at 16 KB.

`requestImage` and `requestFile` require a short request ID and accept no path
payload. They open an explicit system picker for one image or CSV respectively.
Cancellation returns no file. The host rejects directories, symbolic links,
empty/oversized files (10 MB limit), unsupported types, and undecodable images.
Only the selected filename, MIME type and base64 bytes are returned; security
scoped access ends immediately after reading. No folder access is granted to
JavaScript. Concurrent picker requests are rejected. Other bridge operations
are unsupported until implemented with their own permission checks.

React converts selected bytes to a browser File and uses the existing upload
endpoint. Uploaded previews use file metadata IDs, never native paths. The API
continues to validate content and storage paths independently. This boundary is
not account authentication and does not secure an API exposed on the network.

Verification: `swiftc -typecheck GemLifeHost/GemLifeBridge.swift
GemLifeHost/GemLifeWebView.swift GemLifeHost/HostPolicy.swift`; compile
HostPolicy.swift with Tests/GemLifeHostPolicyTests/main.swift to run policy
assertions. Picker presentation itself requires a macOS UI smoke test.
