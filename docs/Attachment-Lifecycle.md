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

## HomeInventory migration

HomeInventory is created by the registered `CreateHomeInventory` migration.
`AddHomeInventoryAttachmentReference` then adds the nullable
`ImageFileMetadataID` foreign key to `FileMetadata.FileMetadataID`. This keeps
the table creation and attachment relationship repeatable for both fresh
databases and existing databases that do not yet contain HomeInventory.

For a live GemLife database, do not create the table manually. Start the API
with the live-database configuration, open `/live-database`, preview the
pending repository migrations, and use the explicit backup-and-migrate action.
Keep the generated backup until the HomeInventory routes and attachment
retrieval have been verified.

## File and image presentation

`Console/src/components/FilePresentation.tsx` is the shared read-only viewer
used by `AttachmentControl` in Addresses and Transactions. It reads metadata
through the cached `useFileMetadataQuery` hook, then requests image bytes only
through `GET /file-metadata/:id/content`. It never resolves a local path in the
browser. Filenames, kind, MIME type, and byte size remain visible even when a
preview cannot be displayed. Missing sizes display as Unknown; a missing
filename falls back to the final segment of the portable relative path.

The presentation states are:

| State | Behavior |
| --- | --- |
| No attachment ID | Empty prompt; no file requests |
| Metadata loading | Accessible loading message |
| Metadata 404 | File-record missing message and retry |
| Other metadata failure | Retryable file-details error |
| Image downloading or decoding | Accessible preview loading message |
| Image loaded | Full image fitted within the preview; no cropping |
| Content 404 | Stored-file missing message; metadata retained |
| Empty, non-image, or undecodable bytes | Invalid/unsupported-image message |
| Network/content failure | Retryable preview error |
| Non-image metadata | Metadata shown; no image bytes requested |

Switching records cancels preview reads, ignores late results, and revokes
object URLs on replacement or unmount. Preview blobs remain scoped to the
viewer rather than accumulating in the query cache. Retry rereads the relevant
metadata or file content without changing the owner's attachment reference.

The browser picker remains the default. `AttachmentControl.selectImage` is an
optional adapter that returns `Promise<File | null>`; a future native SwiftUI
picker can supply file bytes through that boundary. Null means cancellation.
This issue does not implement native permissions, send native bridge commands,
or accept absolute filesystem paths from the web view. Upload and owner PATCH
behavior is unchanged, with non-image and empty browser selections rejected
before uploading. API validation remains authoritative.

Vite proxies both `/file-metadata` and `/file-uploads` to the API. Configure
`VITE_API_TARGET` for the running API as with other console requests.

Run the frontend checks from `Console`:

```sh
npm test
npm run build
```
