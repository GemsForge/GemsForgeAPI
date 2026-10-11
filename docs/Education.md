# Education integration

Education stores Life-area education history in the existing `Education` table.
The API maps the table as it exists in `GemLife_DB_rebuild.sqlite`; it does not
assign records to a Gem Life domain because the table has no `DomainID` column.

## Table mapping

| Database column | Swift property | Purpose |
| --- | --- | --- |
| `EducationID` | `id` | Stable identifier such as `EDU-0001`. |
| `EducationType` | `educationType` | Schooling category, such as College or High School. |
| `InstitutionName` | `institutionName` | Name of the school or institution. |
| `Program` | `program` | Program or degree shorthand. |
| `FieldOfStudy` | `fieldOfStudy` | Major, subject, or area of study. |
| `Credential` | `credential` | Credential earned or pursued. |
| `CredentialID` | `credentialID` | External credential identifier when available. |
| `StartDate` | `startDate` | Stored start date text. |
| `EndDate` | `endDate` | Stored end date text. |
| `AwardedDate` | `awardedDate` | Stored award date text. |
| `Status` | `status` | Current record status; existing rows use `Completed`. |
| `LocationAddressID` | `locationAddressID` | Reference to an existing address record. |
| `Website` | `website` | Institution or program website. |
| `Notes` | `notes` | Additional context about the record. |

The date columns remain optional strings because the existing SQLite table stores
date values as text and does not contain managed `DateCreated` or `DateUpdated`
columns. Education therefore does not use Fluent timestamp property wrappers.

## Service operations

`EducationService` keeps database queries out of HTTP route handlers:

- `list()` returns all education records ordered by start date and institution.
- `find(id:)` returns one record by `EducationID`.
- `save(_:)` creates or updates a record.
- `delete(id:)` deletes one record by `EducationID`.

## HTTP endpoints

| Method | Endpoint | Behavior |
| --- | --- | --- |
| `GET` | `/education` | Returns the Life-area education records. |
| `GET` | `/education/:id` | Returns one education record by ID. |
| `POST` | `/education` | Creates a record with a supplied stable ID. |
| `PUT` | `/education/:id` | Replaces the editable fields of an existing record. |
| `DELETE` | `/education/:id` | Deletes one record. |

The local React testing console should initially use only the two GET endpoints.
Write controls remain outside the UI until the database contract has been
verified through read-only testing.

## Migration boundary

`CreateEducation` exists only for isolated in-memory tests. The application does
not register it against the real Gem Life database because the `Education` table
already exists there.
