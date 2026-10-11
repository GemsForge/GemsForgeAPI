# Employment integration

Employment stores Life-area employment history in the existing `Employment`
table. The API maps the table as it exists in `GemLife_DB_rebuild.sqlite`; it
does not assign records to a Gem Life domain because the table has no
`DomainID` column.

## Table mapping

| Database column | Swift property | Purpose |
| --- | --- | --- |
| `EmploymentID` | `id` | Stable identifier such as `EMP-0001`. |
| `EmployerName` | `employerName` | Employer or business name. |
| `EmployerType` | `employerType` | Organization, Military, or Self-Employed classification. |
| `Industry` | `industry` | Optional industry classification. |
| `Website` | `website` | Optional employer website. |
| `PositionTitle` | `positionTitle` | Role or position held. |
| `EmploymentType` | `employmentType` | Employee, Apprentice, Self-Employed, or another existing value. |
| `StartDate` | `startDate` | Existing start-date text. |
| `EndDate` | `endDate` | Existing end-date text. |
| `EmploymentStatus` | `employmentStatus` | Current or Former status. |
| `WorkAddressID` | `workAddressID` | Optional reference to an existing address record. |
| `EmployerContact` | `employerContact` | Optional contact person or description. |
| `EmployerContactNumber` | `employerContactNumber` | Optional employer contact number. |
| `EmployerContactEmail` | `employerContactEmail` | Optional employer contact email. |
| `Notes` | `notes` | Additional record context. |

The date columns remain optional strings because the existing SQLite table
stores date values as text and does not contain managed `DateCreated` or
`DateUpdated` columns. Employment therefore does not use Fluent timestamp
property wrappers.

## Service operations

`EmploymentService` keeps database queries out of HTTP route handlers:

- `list()` returns employment records ordered by start date and employer name.
- `find(id:)` returns one record by `EmploymentID`.
- `save(_:)` creates or updates a record.
- `delete(id:)` deletes one record.

The employer contact fields contain potentially sensitive personal data. They
are mapped for local, authenticated use and should not be exposed publicly
without an authorization policy.

## HTTP endpoints

| Method | Endpoint | Behavior |
| --- | --- | --- |
| `GET` | `/employment` | Returns Life-area employment records. |
| `GET` | `/employment/:id` | Returns one employment record by ID. |
| `POST` | `/employment` | Creates a record with a supplied stable ID. |
| `PUT` | `/employment/:id` | Replaces the editable fields of an existing record. |
| `DELETE` | `/employment/:id` | Deletes one record. |

The local React testing console will use the two GET endpoints first. UI
support is intentionally a separate follow-up issue.

## Migration boundary

`CreateEmployment` exists only for isolated in-memory tests. The application
does not register it against the real Gem Life database because the
`Employment` table already exists there.

## Verification

With `DATABASE_PATH` set to the real database, the API was verified on a
temporary local port using read-only requests:

- `GET /employment` returned the five existing records `EMP-0001` through
  `EMP-0005`.
- `GET /employment/EMP-0005` returned the GemsForge employment record.

The verification did not run create, update, or delete requests against the
real database.
