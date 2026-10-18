# Editable record fields (Issue #290)

The Console uses `EditableRecordFields` for field rendering and local edit
behavior. Resource views supply the field definitions and call their existing
TanStack Query mutation; successful responses replace the detail cache and
invalidate the corresponding list. The editor submits one changed property at
a time, preserves drafts on errors, and normalizes an omitted nullable value to
an em dash for display.

## Field audit

| Console resource | Editable detail fields | Protected or separate fields |
| --- | --- | --- |
| Addresses | Type, lines 1/2, city, state, postal code, country, dates, status, notes | AddressID is the PK; image is managed by AttachmentControl; DateUpdated is server-managed. |
| Education | Type, institution, program, field of study, credential/credential ID, dates, status, website, notes | EducationID is the PK; location address is an FK; document is managed by AttachmentControl; DateUpdated is server-managed. |
| Employment | Employer/type/industry, website, position, employment type/status, dates, contacts, notes | EmploymentID is the PK; work address is an FK; DateUpdated is server-managed. |
| Service Accounts | Service, type, expense group, amounts/rates, due/occurrence/status, since, payment/account/contact fields including ServiceKey, website, Notion page, notes | ServiceID is the PK; ServiceKey is editable with server-side uniqueness validation; LogoKey is shown read-only because it is a legacy logo lookup relationship without a validated selector; AssociatedAddress is shown read-only because it is an unnormalized legacy relationship value without a validated address selector; logo metadata is managed by AttachmentControl; DateUpdated is server-managed. |
| Transactions | Receipt label, item, first-item flag, merchant code, transaction date, quantity, prices, total, discount, notes | TransactionID is the PK; CategoryID and SubcategoryID are FKs; image is managed by AttachmentControl; DateUpdated is server-managed. |
| Domains | Title and description | DomainID is the PK; DateUpdated is server-managed. |
| ForgeKeeper pages | Title and description | PageID is the PK; DomainID and ParentID are relationships; DateUpdated is server-managed. |

Gem Hues and expense category/subcategory catalogs are reference data and have
no Console/API PATCH workflow, so they remain read-only. FileMetadata and image
records are accessed through explicit attachment controls; the Console does
not expose raw identifiers, storage paths, or ownership metadata as editable
fields. Home Inventory has no record-detail view in the Console and is outside
the current UI surface; do not infer that its fields are editable from this
story.

## Timestamp behavior

`updatedAt` is returned from the server and is not a client-editable field.
Address, Education, and Employment require additive `DateUpdated` migrations
because their legacy schemas did not contain that column. Service Accounts and
Transactions already have the column. The API save services author the value
on create/update; query refreshes do not change it. The live database migration
must be reviewed and explicitly confirmed in the `/live-database` workflow;
tests use isolated in-memory SQLite databases only.

## Checks for future editors

- Add only ordinary scalar fields to `EditableRecordFields`; keep PKs, FKs,
  relationship selectors, attachments, and audit fields out of its save
  payloads.
- Keep field type, nullability, required validation, and the server PATCH
  allowlist aligned. Omitted keys preserve current values; explicit `null`
  clears only nullable fields.
- Keep update/cache logic in the resource's TanStack Query mutation. Use the
  canonical response for the detail cache and invalidate the corresponding
  list; never synthesize `updatedAt` in the Console.
- Test changed-only PATCH payloads, cancel, nullable clearing, invalid/API
  error retention, protected identifiers/relationships, and canonical refresh.
- Run `npm run format:check`, `npm run lint`, `npm run test`, and `npm run build`
  in `Console/`. When API or timestamp contracts change, run the focused Swift
  route tests and `swift test --parallel`.
