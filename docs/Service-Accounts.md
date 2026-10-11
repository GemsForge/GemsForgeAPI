# Service Accounts

Service Accounts are the API's user-facing name for records stored in the
existing `Services` table. They identify recurring services and obligations
that may generate expense transactions; they are not individual purchases.

## Existing table mapping

`Sources/Models/Table/ServiceAccount.swift` maps the existing table without
renaming or recreating it:

```text
ServiceID          stable integer identifier
Service            display name
LogoKey            existing logo reference key
Type               service classification
ExpenseGroup       recurring-expense grouping
MonthlyAmount      recurring amount when applicable
InterestRate / APR financial rate metadata when applicable
Due / Occurrence   payment timing metadata
Status             active, paused, or historical state
Since              service start date or text value
Website / Notes    reference information
NotionPage         legacy/reference page value
PaymentMethod      payment method description
AccountNumber      existing account reference
EmailUpdated       existing email-update metadata
AssociatedAddress existing address reference value
ServiceKey         stable service key when present
```

`DateCreated` and `DateUpdated` remain database-managed text columns and are
not claimed by the Fluent model in this first mapping.

## API contract

The route layer uses the clearer Service Account concept while preserving the
database's historical table name:

```text
GET    /service-accounts
POST   /service-accounts
GET    /service-accounts/:id
PUT    /service-accounts/:id
DELETE /service-accounts/:id
```

The service layer owns list, find, save, and delete operations. Routes validate
the required service name and reject negative amounts or rates.

## Relationship boundary

Transactions represent documented purchases. Service Accounts represent the
recurring service or obligation behind those purchases. This issue does not
add a foreign key to `Transactions`; that relationship must be designed after
the existing schema and transaction identity rules are reviewed.

The current implementation preserves `LogoKey` and `AssociatedAddress` as
existing values. File-backed logos and normalized relationships belong to the
separate FileMetadata and Service Logos issues.

## Migration boundary

`CreateServiceAccounts` mirrors the existing table for isolated tests only. The
production API does not run it against the real Gem Life database at startup.
