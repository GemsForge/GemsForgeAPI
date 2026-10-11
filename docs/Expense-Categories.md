# Expense Categories

Expense Categories are reusable reference data used by expense transactions.
The API maps the existing `BudgetCategories` table; it does not create a new
`Categories` table and does not modify the personal SQLite database.

## Mapping to the existing table

| Swift property | Database column | Purpose |
| --- | --- | --- |
| `id` | `CategoryID` | Stable numeric category identifier. |
| `name` | `Category` | Unique category name used by transactions. |

The table currently contains no emoji column. Category identity therefore
remains independent of presentation metadata. The separate emoji-label feature
will define reusable display labels without putting emoji text into category
records.

## API contract

Routes are registered under `/expense-categories`:

- `GET /expense-categories` returns categories alphabetically by name.
- `POST /expense-categories` creates a category.
- `GET /expense-categories/:id` returns one category.
- `PUT /expense-categories/:id` updates a category name.
- `DELETE /expense-categories/:id` deletes an unused category.

Names are trimmed and must not be empty. Names are unique without regard to
case, so `Health` and `health` cannot become two classifications.

## Relationship and deletion behavior

Transactions reference `BudgetCategories.CategoryID`. The existing database
uses a restricted foreign key, so a category referenced by a transaction cannot
be deleted. The API translates that protected-delete failure into a conflict
response. Archival behavior can be added later if the product needs to retain
historical categories without allowing them for new transactions.

Subcategories depend on this table and are handled by the separate
Subcategories feature. The API does not infer or create subcategory records
while changing a category.

## Migration and verification boundary

`CreateBudgetCategories` mirrors the existing table for isolated tests only.
It is not registered against the personal database. The route tests use an
in-memory SQLite database to verify CRUD, empty-name validation, duplicate
names, and missing-record behavior.
