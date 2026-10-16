# Property-level PATCH contract

This contract defines how Gem Life clients update individual properties without
replacing an entire resource. It applies to the initial resources in issue
#230: addresses, education, employment, services, transactions, home inventory,
and file/image metadata references.

## Request shape

`PATCH /<resource>/:id` accepts a JSON object containing only the properties
being changed. The resource identifier belongs in the URL and cannot appear in
the editable payload.

```json
{
  "city": "Brooklyn",
  "notes": "Updated delivery instructions"
}
```

An omitted property is preserved exactly. A property explicitly supplied as
`null` is cleared only when that field is nullable. Required fields reject
`null`; identifiers, creation timestamps, update timestamps, and other audit
fields are immutable and reject attempts to change them.

Empty objects are invalid. Unknown properties are rejected rather than ignored,
so a client cannot believe it saved a field that the API discarded.

## Response shape

Successful updates return `200 OK` and the complete updated resource using the
same response representation as `GET /<resource>/:id`. The response is the
server's canonical representation after validation and relationship handling.

## Errors

Validation failures return `422 Unprocessable Entity` with a stable field-level
shape:

```json
{
  "error": true,
  "reason": "Validation failed",
  "fields": {
    "startDate": "Use YYYY-MM-DD."
  }
}
```

Malformed JSON uses `400 Bad Request`; an unknown resource ID uses `404 Not
Found`; a stale conditional update uses `409 Conflict`.

## Relationships and file metadata

Relationship properties are explicit updates. Replacing a `FileMetadataID`
must validate that the target exists, attach the new reference, and preserve
the old metadata row for history/revert unless an explicit cleanup operation
is requested. The API must not silently delete or orphan metadata. An invalid
foreign-key value returns a field-level validation error.

## Concurrency

Clients may send `If-Unmodified-Since` or the resource's current update token
when the endpoint supports it. If the record changed since the client read it,
the API returns `409 Conflict` and the current representation; it does not
silently overwrite a newer update.

## Initial editable-property matrix

The route implementation must publish the exact editable properties for each
resource. The following fields are the initial scope; primary keys and audit
fields are excluded unless explicitly marked editable by a later contract:

| Resource | Initial editable areas |
| --- | --- |
| Addresses | address type/lines, city/state/postal code/country, dates, status, notes, image metadata reference |
| Education | education details, dates, status, location address, document metadata reference |
| Employment | employer details, position, dates, status, work address, contact fields, notes |
| Services | service details, financial settings, status, contact/account fields, logo metadata reference |
| Transactions | receipt/item/category/subcategory, prices, quantity, date, notes, image metadata reference |
| Home inventory | item identity, location, condition, value, notes, image metadata reference |
| File metadata | descriptive metadata only; stored path, identifier, and ownership references are protected |

Every resource implementation must add focused tests for single-property,
multi-property, omitted-property, nullability, unknown-property, immutable
field, relationship, and stale-update behavior.

## Implementation status

The shared validation rules are implemented in
`Sources/Services/PropertyPatchValidation.swift`. The current API rollout
covers Addresses, Domains, Employment, Education, Transactions, and Service
Accounts. Typed PATCH request models must perform strict JSON-key validation so
unknown properties are rejected before decoding; dictionary-based handlers must
use the same allowed-property check. New resources should follow this contract
and add their route tests before being exposed to the UI.
