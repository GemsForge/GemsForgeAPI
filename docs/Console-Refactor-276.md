# Console cleanup note — #276

## Consolidated

- Record detail views now use `RecordFields` for semantic label/value rendering and
  one responsive field-grid style. Each feature still defines its own labels,
  values, links, and exceptional empty-state copy.
- Address, education, employment, transaction, and service-account scalar edits
  now use `PropertyEditor` backed by `useRecordEditor` for draft, dirty, cancel,
  save, and safe failure behavior.
- Detail query feedback and scalar edit failures use `presentError` so transport
  errors do not expose raw API details.

## Intentionally kept resource-specific

- Each feature retains its own editable field allowlist and explicit PATCH
  mapping; the shared editor only handles one scalar value and cannot choose a
  property or submit an unrestricted record object.
- Attachment upload, replacement, removal, and preview remain in
  `useAttachmentWorkflow`, `AttachmentControl`, and `FilePresentation`; these
  flows have file-specific validation, ownership, and retry behavior.
- ForgeKeeper page editing remains a separate multi-field dialog because it
  supports parent relationships and a distinct modal interaction.
