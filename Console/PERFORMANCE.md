# UI performance baseline

M3 measurements from production Vite builds (decimal KB, minified, before gzip):

| Measure                                  | Before #148               | After #148                 |
| ---------------------------------------- | ------------------------- | -------------------------- |
| Largest JavaScript file                  | 576.87 KB                 | 231.13 KB                  |
| Design-system chunk                      | Part of the single bundle | 221.86 KB                  |
| Query/cache chunk                        | Part of the single bundle | 44.75 KB                   |
| Router chunk                             | Part of the single bundle | 38.32 KB                   |
| Largest feature chunk (Schema Builder)   | Eagerly included          | 12.18 KB, loaded on demand |
| Rendered data rows for a 1,000-row table | 1,000                     | 50 per page                |

The largest file is about 60% smaller, but that is **not** a 60% startup-time or
total-download claim: shared chunks still load initially and chunk boundaries
add overhead. Features are lazy-loaded with loading/error recovery. Browser
smoke testing confirmed home and a lazy Schema Builder screen in the production
preview, without runtime errors. Recheck sizes using npm run build after changes.

`usePagedRecords` bounds list/table DOM work to 50 records and memoizes each page.
Gem Hues, Education, Employment, Addresses, Transactions and ForgeKeeper use it;
GemDataTable shares the same behavior. Paging controls announce the visible range
and clamp when data shrinks. Tests cover a 10,000-record slice and the actual
1,000-row table rendering only 50 rows (95% fewer data-row elements).

This is client-side paging: existing API endpoints still return full lists. It
does not reduce SQL work or response payloads. Add server pagination only with
an explicit API contract and measurements showing the need; virtualization is
not required merely to avoid rendering every row.

Queries stay fresh for 30 seconds, inactive records expire after five minutes,
and writes invalidate affected keys. HTTP cache is bypassed for personal data;
the intentional cache is in memory and clears on local-session end. No automatic
mutation retries. Cache-isolation tests show revisiting a fresh record reuses its
cached detail instead of fetching it again.

Images decode asynchronously. Gem Hue previews load lazily and their inactive
blob queries expire after one minute. File preview bytes remain viewer-scoped,
aborted on change/unmount, and object URLs are revoked. Do not lazy-load an image
that is hidden until its load event: it could never become eligible to load.
The responsive fixture now includes 1,000 synthetic table rows for repeatable
browser inspection without personal data or writes.
