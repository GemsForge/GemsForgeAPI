# Expense Subcategories integration

Expense Subcategories are reusable classifications beneath an expense
category. The API maps the existing `BudgetSubcategories` table and preserves
its parent-category relationship without changing the personal SQLite
database.

## Mapping to the existing table

| Swift property | Database column | Purpose |
| --- | --- | --- |
| `id` | `SubcategoryID` | Stable numeric subcategory identifier. |
| `categoryID` | `CategoryID` | Required parent `BudgetCategories` identifier. |
| `name` | `Subcategory` | Subcategory name, unique within its parent category. |

The database allows the same subcategory name under different categories, but
not twice under the same category. The API applies the same rule without
regard to letter case.

## API contract

Routes are registered under `/expense-subcategories`:

- `GET /expense-subcategories` returns subcategories ordered by category and
  name.
- `GET /expense-subcategories?categoryID=:id` filters by parent category.
- `POST /expense-subcategories` creates a subcategory.
- `GET /expense-subcategories/:id` returns one subcategory.
- `PUT /expense-subcategories/:id` updates its name or moves it to another
  valid category.
- `DELETE /expense-subcategories/:id` deletes an unused subcategory.

Create and update operations reject missing parent categories, empty names,
and duplicate names within the same parent. A protected delete returns a
conflict response when transactions still reference the subcategory.

## Separation from presentation

The table contains classification data only. It does not store emoji values;
reusable emoji presentation belongs to the separate emoji-label definition
feature.

## Migration and verification boundary

`CreateBudgetSubcategories` mirrors the existing table, including its parent
foreign key and per-category uniqueness rule, for isolated tests only. It is
not registered against the personal database. Route tests use in-memory
SQLite to verify CRUD, category filtering, parent validation, and duplicate
names.
