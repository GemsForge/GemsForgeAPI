# Gem Life UI standards

This is the maintenance guide for the M3 UI foundations in the existing
GemsForgeAPI repository. Preserve the established data schema, IDs, taxonomy,
route contracts, visual palette, and native/web boundary when extending it.

## Documentation map

| Concern | Source |
| --- | --- |
| Architecture and state ownership | [ARCHITECTURE.md](ARCHITECTURE.md) |
| Labels, keyboard, focus, contrast | [ACCESSIBILITY.md](ACCESSIBILITY.md) |
| Breakpoints and browser fixture | [RESPONSIVE_TESTING.md](RESPONSIVE_TESTING.md) |
| Caching, pagination, bundle measurements | [PERFORMANCE.md](PERFORMANCE.md) |
| Device-local session scope | [LOCAL_ACCESS.md](LOCAL_ACCESS.md) |
| Native security and production packaging | [Host README](../GemLifeHost/README.md) |
| Attachment lifecycle | [Attachment contract](../docs/Attachment-Lifecycle.md) |
| Commit types and push checks | [Commit policy](../docs/Commit-Policy.md) |
| Issues, relationships, PRs, project Status | [Issue workflow](../.github/ISSUE_WORKFLOW.md) |

## Names and folders

Use PascalCase for React components and their `.tsx` files. Shared visual
primitives use the `Gem` prefix; feature screens use descriptive names ending
in `View`. Hooks start with `use` and describe behavior, such as
`useSchemaBuilder`, not the current page layout. Export typed props when they
are reusable. Tests sit beside the code as `.test.ts` or `.test.tsx`.

```text
Console/src/
├── api.ts                  HTTP transport and standardized APIError
├── types.ts                existing API request/response contracts
├── components/
│   ├── ui/                 visual primitives without API ownership
│   └── layout/             persistent application frame
├── features/               domains, life records, database/schema screens
├── hooks/                  drafts, approvals, uploads, local session, paging
├── data/                   query keys, server reads, mutations, invalidation
├── routes/                 exact URL routes and feature loading boundaries
├── bridge/                 typed messages and native picker adapter
├── design-system/          Tamagui tokens, fonts, themes, media keys
└── test/                   test setup and synthetic visual fixture
```

Keep new features here rather than creating a duplicate sibling application.
Put server models/services/routes/migrations in Sources, not in the UI. SwiftUI
window, WebKit and native capability code belongs in GemLifeHost.

## Visual system

`src/design-system/tamagui.config.ts` is the token definition. It extends the
installed Tamagui configuration export `@tamagui/config/v5`.

| Token | Role |
| --- | --- |
| gemCanvas | Application background |
| gemPanel / gemPanelLight | Grouped surfaces and borders |
| gemInk / gemMuted | Primary and secondary text |
| gemMint / gemMintDark | Primary action and supporting surface |
| gemGold | Reference/status accent |
| gemDanger | Error emphasis; use readable contrasting text |

Semantic spacing is gemCompact 8, gemControl 12, gemSection 24, gemPage 32;
radii are gemControl 8 and gemCard 16. Typography uses the system-font stack
with 12/14/16/20/28/36px sizes and matching line heights. Inter is a preferred
local font, not a required remote download. Do not add one-off tokens without
checking whether an existing role fits.

Dark is the application default. A light Tamagui theme is defined, but the
legacy feature CSS is still dark and there is no complete light-mode toggle.
Existing CSS variables remain a compatibility layer; palette changes must keep
them aligned with the token definitions until those features migrate. Do not
claim all legacy markup is already composed of Tamagui primitives.

Use GemButton, GemField, GemCard, GemSectionHeader, GemStatusPill,
GemEmptyState, GemLoadingState, and GemDataTable for reusable visual behavior.
AttachmentControl/FilePresentation own feature behavior and compose the data
layer rather than becoming generic visual primitives.

## State and data rules

Use simple component state for an open dialog or selected ID. Use custom hooks
for feature workflows and reducers for related transitions. Schema/CSV edits
invalidate approval; late previews cannot approve an edited draft. Database
filename/profile changes require new confirmation. Do not put server records
into a second copied component-state cache.

Use query hooks for reads and mutation hooks for writes. Query keys must include
record IDs and page scope. Pass cancellation signals through the API client.
Preserve APIError status, distinguish offline from HTTP errors, and keep loading,
empty, error, retry and success states separate. Invalidate only affected cache
keys after writes; never automatically retry a database-changing request.

The file-preview component intentionally owns its short-lived binary request,
AbortController and object URL. This is not a second JSON/server-state cache.
Keep personal data out of browser persistence and the HTTP cache. Client-side
paging limits rendered rows, not API payloads; do not imply server pagination.

## Navigation, accessibility and layout

React owns routes inside the web app; SwiftUI owns native capabilities and the
window. Routes are explicit, not pathname prefixes copied into state. Use router
links and stable IDs, including encoded domain IDs. Keep Back/Forward, deep links,
unknown routes and failed requests consistent. The production base is `/app/`;
API paths remain at the origin root. Features load lazily inside loading/error
boundaries, with explicit reload recovery if a deployed chunk changes.

All controls need a visible label or specific accessible name. Preserve semantic
links/buttons, status/error announcements, the skip link, route focus, named
dialogs and tables, visible focus rings and reduced-motion behavior. Normal text
targets 4.5:1 contrast; automated token checks are not a full accessibility audit.

Use compact 640px, tablet 900px and desktop 1200px thresholds. Navigation
collapses at tablet widths; feature grids stack below desktop. Long text, forms,
previews and dialogs must fit; wide tables scroll inside their region. Verify
actual browser geometry, not only jsdom snapshots. See the recorded fixture
measurements and limitations in the responsive guide.

## Native capability and session rules

There is one gemLife handler, with runtime envelope validation on both sides.
Only the exact trusted loopback origin/main frame may invoke it. Remote pages,
file URLs, arbitrary path payloads, unsupported operations and invalid request
IDs are rejected. Native image/CSV requests open an explicit single-file picker;
return only approved bytes, MIME and filename. Keep path/type/size checks on the
server too; a safe client picker does not replace upload validation.

Declared message names are not proof that a capability is implemented. Currently
file/image picking and device-local session end have native handlers. Images use
the native adapter when hosted; ordinary browser file controls remain available.
Navigation/share/account capabilities need their own implementation and policy.

Device-local access is the chosen M3 scope. End/resume clears local UI state;
it is not server login/logout or protection against other API clients. Do not
invent passwords, credentials, session expiry, or authenticated routes without
a server contract. Keep the API on loopback; remote deployment remains separate.

## Configuration and release workflow

| Setting | Where it belongs |
| --- | --- |
| DATABASE_PATH | Local Xcode Run scheme; ignored .env/export for terminal launcher |
| LIVE_DATABASE_BACKUP_DIRECTORY | Local Xcode Run scheme; ignored .env/export for terminal launcher |
| PROJECTS_TOKEN | GitHub repository Actions secret only |
| GEM_LIFE_CONSOLE_URL | Optional local host scheme/environment; loopback URL only |

Never commit secrets to a shared scheme, source file or VITE-prefixed variable.
Foundation and Darwin imports in the Swift launcher are platform modules, not
extra installed packages. Foundation supplies Process/URL/FileManager; Darwin
provides macOS/POSIX functions used by the launcher.

Development: start the React server and run `swift run GemLife` from the repo
root with local environment configured. Production: run
`node Scripts/build-gem-life.mjs`, then `GEM_LIFE_PRODUCTION=1 swift run GemLife`.
The host resource bundle includes versioned React assets, served by the local
release API without Vite. This is not a signed/notarized distribution pipeline.

## Verification and known boundaries

For UI changes run `npm test` and `npm run build` in Console; Console checks CI
runs both. For API changes run `swift test` with personal database settings
removed. Native policy assertions and Swift release compilation complement the
browser fixture; picker presentation and VoiceOver still need a real macOS
smoke/audit when changed. Commit policy and metadata checks do not replace tests.

Original M3 foundation issues were implemented through one numbered branch and
closing PR per issue, with checks before authorized squash merges. Assignees,
labels, milestones, project membership and lifecycle Status use the existing
repository workflow; native issue relationships require explicit inputs rather
than invented dependencies. Do not open/merge unrelated PRs without authority.

Live-data schema mismatch is tracked in [#178](https://github.com/GemsForge/GemsForgeAPI/issues/178):
Education, Employment, Addresses and Transactions currently report missing
attachment columns against the user's configured database. Isolated API tests
passing does not prove that this live schema is migrated. Preserve data, diagnose
the mismatch and back up before any approved migration. Account sign-in,
server pagination, a complete light-mode migration and remote hosting are not
silently included in the completed foundations.
