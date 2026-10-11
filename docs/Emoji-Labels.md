# Emoji Label Definitions

Emoji labels are reusable presentation metadata for the Gem Life taxonomy.
They allow the UI to display a consistent symbol and description without
making an emoji part of a category or subcategory's identity.

## Why this is a separate table

The existing `BudgetCategories` and `BudgetSubcategories` tables contain
classification data only and do not currently contain emoji columns. The API
therefore does not remove or rewrite emoji values in those tables. A separate
registry keeps presentation metadata reusable and allows labels to be
deactivated without deleting historical definitions.

## Mapping to `EmojiLabelDefinitions`

| Swift property | Database column | Purpose |
| --- | --- | --- |
| `id` | `EmojiLabelID` | Stable numeric identifier. |
| `label` | `Label` | Unique human-readable label name. |
| `emoji` | `Emoji` | Display symbol or emoji value. |
| `description` | `Description` | Optional explanation of intended use. |
| `isActive` | `IsActive` | Whether the label is available for new presentation choices. |

## API contract

Routes are registered under `/emoji-labels`:

- `GET /emoji-labels` returns active labels by default.
- `GET /emoji-labels?includeInactive=true` returns the complete registry.
- `POST /emoji-labels` creates a definition.
- `GET /emoji-labels/:id` returns one definition.
- `PUT /emoji-labels/:id` updates a definition, including active status.
- `DELETE /emoji-labels/:id` deletes a definition not yet protected by a
  future taxonomy relationship.

Labels are trimmed and unique without regard to case. Emoji values must be
non-empty, but the API does not impose a language-specific character count.

## Migration and verification boundary

`CreateEmojiLabelDefinitions` creates the registry for isolated tests only.
It is not registered against the personal SQLite database. The real database
was inspected read-only and no emoji-label table exists there yet.

The route tests use in-memory SQLite to verify active filtering, CRUD behavior,
duplicate-label protection, and invalid payloads.
