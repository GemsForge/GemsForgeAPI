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
