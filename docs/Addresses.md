# Addresses integration

Addresses stores Life-area address records in the existing `Addresses` table.
The API preserves the table's stable identifiers and does not assign addresses
to a Gem Life domain because the table has no `DomainID` column.

## Table mapping

The `Address` model maps `AddressID`, `AddressType`, `AddressLine1`,
`AddressLine2`, `City`, `State`, `PostalCode`, `Country`, `StartDate`,
`EndDate`, `AddressStatus`, and `Notes` without renaming the existing database
columns. Date values remain optional strings because the source table stores
text dates.

## HTTP endpoints

| Method | Endpoint | Behavior |
| --- | --- | --- |
| `GET` | `/addresses` | Returns privacy-conscious address summaries. |
| `GET` | `/addresses/:id` | Returns one complete address record. |
| `POST` | `/addresses` | Creates an address in isolated/test workflows. |
| `PUT` | `/addresses/:id` | Replaces an existing address. |
| `DELETE` | `/addresses/:id` | Deletes one address in isolated/test workflows. |

## Embedded address responses

Education and Employment retain `LocationAddressID` and `WorkAddressID` in
their table models and request payloads because those are the database foreign
keys used for writes. Their API responses now expand the relationship into an
`address` object so clients can render the address without making a second
lookup request.

```text
Education.LocationAddressID ─┐
                             ├── address: AddressReferenceResponse
Employment.WorkAddressID ────┘
```

The embedded object includes the stable address ID and address fields. Missing
or stale references return `address: null`; the parent record remains readable.

## Migration boundary

`CreateAddresses` exists only for isolated in-memory tests. The application
does not register it against the real Gem Life database because the `Addresses`
table already exists there.

## Verification

Read-only requests against the configured Gem Life SQLite database confirmed
embedded addresses for `EDU-0001` and `EMP-0002`, as well as direct address
retrieval for `ADDR-0016`. No real records were changed.
