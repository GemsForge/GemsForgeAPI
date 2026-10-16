# Record creation contracts

The Gem Life console creates records through resource-specific `POST` routes.
Create payloads are intentionally separate from response models: clients may
provide editable business fields and, where the existing database contract
requires it, a stable identifier. Database-managed timestamps, relationship
references owned by the server, and other audit fields are never accepted as
client authority.

## Contract rules

- Required fields are validated before persistence and report a `400` or
  `422` response with an actionable reason.
- A client-supplied identifier is preserved only for resources whose existing
  schema uses caller-owned stable identifiers. Resources with server-owned
  identifiers generate them on the server.
- Duplicate identifiers and duplicate natural keys return `409 Conflict`.
- Foreign keys and related records are checked before the new record is
  saved.
- Attachment references are validated and attached through the server-owned
  relationship service.
- `DateCreated`, `DateUpdated`, and other audit fields are database-managed;
  they are response fields, never create authority.

## Current resource matrix

| Resource | Route | Identifier policy | Relationship checks |
| --- | --- | --- | --- |
| Domain | `POST /domains` | Optional stable ID; server preserves it | None |
| Education | `POST /education` | Required stable ID | Address and attachment references are validated |
| Employment | `POST /employment` | Required stable ID | Address and attachment references are validated |
| Address | `POST /addresses` | Required stable ID | Attachment reference is validated |
| Service Account | `POST /service-accounts` | Optional schema ID | Logo attachment reference is validated |
| Transaction | `POST /transactions` | Required stable ID | Category, subcategory, and attachment references are validated |
| Expense Category | `POST /expense-categories` | Optional server-generated ID | Natural-name uniqueness |
| Expense Subcategory | `POST /expense-subcategories` | Optional server-generated ID | Parent category must exist; scoped-name uniqueness |
| Emoji Label | `POST /emoji-labels` | Optional server-generated ID | Label uniqueness and active-state rules |
| File Metadata | `POST /file-metadata` | Optional server-generated ID | Owner references are attached server-side |
| Home Inventory | `POST /home-inventory` | Optional server-generated inventory ID | None |

The focused route tests are the executable contract. This document records the
cross-resource rules that the UI and API must preserve as create forms are
added.
