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
