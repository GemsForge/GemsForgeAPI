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

The SwiftUI/React message bridge is intentionally not included here. That is
tracked separately in issue #134 so native capabilities can be introduced with
typed messages rather than coupling the host to React implementation details.
