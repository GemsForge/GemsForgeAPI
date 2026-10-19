# Gem Hue import

The authenticated Test Console's **Gem Hues** page accepts a pasted CSV or JSON
array. Use the column names from the `GemHues` table: `HueID`, `ColorName`,
`ColorFamily`, `HexCode`, `Mood`, `Palette`, `Description`, `CreatedDate`, and
`Notes`. `HueID`, `ColorName`, and `HexCode` are required.

Choose **Preview import** before writing anything. The preview checks required
fields and duplicate IDs. **Publish records** is a separate explicit action and
publishes the batch transactionally; if a row fails, no rows are added.

CSV exports from DBeaver should include the header row. JSON must be an array of
objects using the same column names. Images are not part of this import and must
be attached separately.

## Preview validation and database constraints

Preview validation is application-level feedback. It checks required fields,
duplicate `HueID` values, duplicate `ColorName` values within the import, and
values that already exist in the database. Preview does not write anything.

The database remains the final authority. SQLite unique constraints can reject
a publish even when an older console build reported all rows as valid. For
example, `GemHues.ColorName` is unique, so a conflicting color name must be
reported before publication. The publish operation is transactional: a failed
constraint check does not leave a partial batch behind.

If the API or Console was already running while the importer changed, restart
both processes so the current preview and publish contracts are loaded.
