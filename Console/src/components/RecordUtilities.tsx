import type { RecordSortDirection } from "../hooks/useRecordUtilities";

export function RecordUtilities({ label, search, onSearch, sort, onSort, direction, onDirection, filter, onFilter, filterOptions = [], sortOptions }: {
  label: string; search: string; onSearch: (value: string) => void; sort: string; onSort: (value: string) => void;
  direction: RecordSortDirection; onDirection: () => void; filter: string; onFilter: (value: string) => void;
  filterOptions?: string[]; sortOptions: { value: string; label: string }[]; totalCount?: number; visibleCount?: number;
}) {
  return <div className="record-utilities" aria-label={`${label} utilities`}>
    <label>Search {label.toLowerCase()}<input type="search" value={search} onChange={(event) => onSearch(event.target.value)} placeholder={`Search ${label.toLowerCase()}…`} /></label>
    <label>Sort by<select value={sort} onChange={(event) => onSort(event.target.value)}><option value="">Default order</option>{sortOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
    <button type="button" className="secondary-button" onClick={onDirection} aria-label={`Sort ${direction === "asc" ? "descending" : "ascending"}`}>{direction === "asc" ? "A–Z" : "Z–A"}</button>
    {filterOptions.length > 0 && <label>Filter<select value={filter} onChange={(event) => onFilter(event.target.value)}><option value="">All</option>{filterOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>}
    {(search || sort || filter) && <button type="button" className="secondary-button" onClick={() => { onSearch(""); onSort(""); onFilter(""); }}>Clear filters</button>}
    <span className="record-utility-summary" role="status">{visibleCount ?? totalCount ?? 0} of {totalCount ?? visibleCount ?? 0} matching</span>
  </div>;
}
