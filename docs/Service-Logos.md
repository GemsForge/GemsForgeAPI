# Service Logos

Service logo images are stored in `FileMetadata`. The Console renders the logo
referenced directly by `Services.LogoFileMetadataID` and retrieves its bytes
through the authenticated file-content endpoint.

## Retained legacy table

`ServiceLogoAssets` is no longer part of the runtime logo lookup path. Existing
rows may still hold the old `LogoKey` to `FileMetadataID` association, so the
`BackfillServiceAccountLogoFileMetadata` migration copies matching IDs to the
corresponding `Services` rows without replacing an already assigned logo.
Legacy BLOB migration code remains available for databases that have not yet
moved those image bytes into `FileMetadata`.

The table and `Services.LogoKey` column remain in the database for now. Removing
them requires a separate reviewed schema migration after the backfill has been
previewed and verified on the target database. Unowned rows are skipped until
the explicit Hub ownership assignment runs the backfill again. The API no longer exposes
`/service-logos` read routes, and the Console no longer requests catalog logos.

## Verification boundary

The backfill migration is tested against an isolated SQLite database. It is
registered in the development migration profile but has not been applied to the
personal database by this change.
