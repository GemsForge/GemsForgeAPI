# Service Logos

Service Logos are image assets associated with records in the existing
`Services` table. The current Gem Life database stores them in the separate
`ServiceLogoAssets` table using legacy image BLOBs and a stable `LogoKey`.

## Current database mapping

| Swift property | Database column | Purpose |
| --- | --- | --- |
| `id` | `LogoAssetID` | Stable numeric logo asset identifier. |
| `logo` | `Logo` | Existing legacy image bytes. |
| `mimeType` | `MimeType` | Stored image content type. |
| `fileName` | `FileName` | Optional original/display filename. |
| `fileSizeBytes` | `FileSizeBytes` | Optional stored size; API falls back to the BLOB size. |
| `createdAt` | `DateCreated` | Existing creation timestamp. |
| `updatedAt` | `DateUpdated` | Existing update timestamp. |
| `logoKey` | `LogoKey` | Stable unique lookup/display key. |

The API maps this existing schema without adding a `FileMetadataID` column or
altering the personal database. The future storage migration can connect logo
records to portable local-file metadata after that relationship is explicitly
designed.

## API contract

The read routes are registered under `/service-logos`:

- `GET /service-logos` returns lightweight logo metadata for all assets.
- `GET /service-logos/:id` returns metadata for one asset.
- `GET /service-logos/:id/image` explicitly returns the stored image bytes.

Collection and detail responses never embed the BLOB. The response includes
an `imagePath` so a client can request the binary only when it needs to render
the logo. A missing logo identifier or image returns `404 Not Found`; an
invalid stored MIME type returns `500 Internal Server Error` rather than an
ambiguous response.

## FileMetadata boundary

Issue #57 establishes the portable local-file bridge. This issue preserves the
existing BLOB-backed table because it is the schema currently in the real
database. The service-logo API is therefore compatible with today's data while
keeping binary delivery explicit.

When the logo relationship is migrated to FileMetadata, the API should resolve
the relative path through the configured local asset root, report missing files
as unavailable, and keep absolute machine paths out of responses. That change
belongs in a separate schema/storage migration and should not be silently
introduced into this compatibility step.

## Verification boundary

`CreateServiceLogoAssets` mirrors the existing table for isolated tests only.
The route tests verify metadata-only list/detail responses, explicit image
delivery, MIME type handling, and missing-asset `404` behavior using an
in-memory SQLite database.
