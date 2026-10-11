# FileMetadata

`FileMetadata` is the local-file bridge between files stored on the device and
structured records stored in SQLite. It keeps the database small and portable
by storing a relative path and descriptive metadata instead of embedding the
file's binary contents.

## What the model represents

One `FileMetadata` record describes one local file. It does not upload, move,
read, or delete the file. Those filesystem operations belong to a later,
authenticated upload workflow.

The `RelativePath` is resolved by the host application against its configured
local asset directory. Absolute machine-specific paths do not belong in the
database or in API payloads.

## Mapping to the `FileMetadata` table

| Swift property | Database column | Purpose |
| --- | --- | --- |
| `id` | `FileMetadataID` | Stable identifier for the metadata record. |
| `relativePath` | `RelativePath` | Portable path from the configured asset root to the file. |
| `fileName` | `FileName` | Optional display or original filename. |
| `fileKind` | `FileKind` | Controlled classification such as `image`, `document`, or `audio`. |
| `mimeType` | `MimeType` | Content type such as `image/png`. |
| `byteSize` | `ByteSize` | Optional file size in bytes. |
| `checksum` | `Checksum` | Optional integrity or duplicate-detection value. |
| `ownerType` | `OwnerType` | Optional owning record type, such as `ExpenseTransaction`. |
| `ownerID` | `OwnerID` | Optional identifier of the owning record. |

`OwnerType` and `OwnerID` are an ownership pair: the API requires both or
neither. The model intentionally does not impose a single foreign-key target,
because files may later belong to transactions, education records, addresses,
service accounts, or other features.

## API contract

The routes are registered under `/file-metadata`:

- `GET /file-metadata` returns metadata records without loading file contents.
- `POST /file-metadata` creates a metadata record.
- `GET /file-metadata/:id` returns one metadata record.
- `PUT /file-metadata/:id` replaces one metadata record.
- `DELETE /file-metadata/:id` removes metadata only; it does not delete the
  referenced file from disk.

The routes reject absolute paths, paths containing `..`, empty paths, invalid
MIME types, negative byte sizes, and incomplete ownership pairs.

## Service boundary

`FileMetadataService` owns database persistence for metadata records. It
provides list, find, save, and delete operations. It deliberately has no
filesystem permissions or file-management responsibilities. That separation
keeps the first schema/API step safe and allows the later upload feature to
define path validation, collision handling, replacement, and cleanup as a
separate design.

## Migration and verification boundary

`CreateFileMetadata` exists for isolated tests. It is not registered as a
production migration against the personal SQLite database. A read-only
inspection of `/Users/gemsforge/DBeaver/GemLife_DB_rebuild.sqlite` found no
existing `FileMetadata` table, and this issue does not modify that database.

The route tests create the table in an in-memory SQLite database and verify
the CRUD contract plus the path and ownership safety rules.
