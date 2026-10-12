# Attachment lifecycle

The attachment workflow keeps the file system and the structured database
separate:

1. The uploaded bytes live under the configured `ASSET_DIRECTORY`.
2. `FileMetadata` stores a portable relative path, filename, MIME type, size,
   and ownership information in SQLite.
3. An owner table stores the `FileMetadataID` reference needed to render the
   attachment.

Absolute paths never appear in API responses or browser requests.

## Upload and retrieval

Configure `ASSET_DIRECTORY` and optionally `ASSET_MAX_BYTES`, then upload an
image with `POST /file-uploads` as multipart form data. The response contains
the generated metadata ID. Retrieve the bytes with:

```text
GET /file-metadata/:id/content
```

The route resolves only relative paths beneath the configured asset directory,
streams the stored MIME type, and returns 404 for missing metadata or files.
Path traversal and absolute paths are rejected.

## Owner references

Owner records keep references rather than binary data:

| Record | Reference column | Owner type |
| --- | --- | --- |
| Addresses | `ImageFileMetadataID` | `Address` |
| Service Accounts | `LogoFileMetadataID` | `ServiceAccount` |
| Transactions | `Image` | `ExpenseTransaction` |
| Education | `DocumentFileMetadataID` | `Education` |

The console uses the small owner-specific PATCH endpoints when replacing or
removing an attachment:

```text
PATCH /addresses/:id/attachment
PATCH /transactions/:id/image
```

The body is `{ "fileMetadataID": "..." }`; send `null` to detach. The API
validates that the metadata exists and is not already owned by another record.

## Replacement and cleanup

Replacement attaches the new metadata first, updates the owner reference, then
detaches the old metadata. The old file is not deleted automatically. This
preserves recoverability and makes orphan cleanup a deliberate maintenance
operation rather than a side effect of editing a record.

## Testing console

Addresses and Transactions expose the reusable attachment control. It supports
choosing an image, showing a preview, replacing an image, removing a reference,
and displaying API validation errors. The same pattern can be reused for
Service Accounts, Education, and future HomeInventory records.

The user-facing concept is **Service Account Catalog**, even though the legacy
SQLite table remains named `Services`.
