import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import type { RecordSortDirection } from "../hooks/useRecordUtilities";

type CompactUtilityMenu = "sort" | "filter" | null;

export function RecordUtilities({
  label,
  search,
  onSearch,
  sort,
  onSort,
  direction,
  onDirection,
  filter,
  onFilter,
  filterOptions = [],
  sortOptions,
  totalCount,
  visibleCount,
  compact = false,
}: {
  label: string;
  search: string;
  onSearch: (value: string) => void;
  sort: string;
  onSort: (value: string) => void;
  direction: RecordSortDirection;
  onDirection: () => void;
  filter: string;
  onFilter: (value: string) => void;
  filterOptions?: string[];
  sortOptions: { value: string; label: string }[];
  totalCount?: number;
  visibleCount?: number;
  /** Keep secondary query controls behind one labeled, focus-restoring menu. */
  compact?: boolean;
}) {
  const [compactMenu, setCompactMenu] = useState<CompactUtilityMenu>(null);
  const [searchOpen, setSearchOpen] = useState(Boolean(search));
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  useEffect(() => {
    if (compactMenu) {
      menuRef.current?.querySelector<HTMLButtonElement>("[role^='menuitem']")?.focus();
    } else if (triggerRef.current) {
      triggerRef.current.focus();
    }
  }, [compactMenu]);

  if (compact) {
    const menuId = `${label.toLowerCase().replace(/\s+/g, "-")}-query-menu`;
    const closeCompactMenu = () => setCompactMenu(null);
    const clearQuery = () => {
      onSearch("");
      onSort("");
      onFilter("");
      closeCompactMenu();
    };
    const openCompactMenu = (next: Exclude<CompactUtilityMenu, null>, event: MouseEvent<HTMLButtonElement>) => {
      triggerRef.current = event.currentTarget;
      setCompactMenu((current) => (current === next ? null : next));
    };
    const handleCompactMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
      const items = [...(menuRef.current?.querySelectorAll<HTMLButtonElement>("[role^='menuitem']") ?? [])].filter(
        (item) => !item.disabled,
      );
      if (!items.length) return;
      const currentIndex = items.indexOf(document.activeElement as HTMLButtonElement);
      if (event.key === "Escape") {
        event.preventDefault();
        closeCompactMenu();
        return;
      }
      if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Home" || event.key === "End") {
        event.preventDefault();
        const nextIndex =
          event.key === "Home"
            ? 0
            : event.key === "End"
              ? items.length - 1
              : (currentIndex + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
        items[nextIndex]?.focus();
      }
    };

    return (
      <div className="record-utilities record-utilities-compact" aria-label={`${label} utilities`}>
        {searchOpen && (
          <label className="record-utilities-search-field">
            <span className="sr-only">Search {label.toLowerCase()}</span>
            <input
              ref={searchRef}
              type="search"
              value={search}
              onChange={(event) => onSearch(event.target.value)}
              placeholder={`Search ${label.toLowerCase()}…`}
            />
          </label>
        )}
        <button
          type="button"
          className="compact-icon-button"
          aria-label={searchOpen ? "Close search" : `Search ${label.toLowerCase()}`}
          title={searchOpen ? "Close search" : `Search ${label.toLowerCase()}`}
          onClick={() => setSearchOpen((open) => !open)}
        >
          <span aria-hidden="true">⌕</span>
        </button>
        <button
          type="button"
          className="compact-icon-button"
          aria-haspopup="menu"
          aria-expanded={compactMenu === "sort"}
          aria-controls={menuId}
          aria-label="Sort records"
          title="Sort records"
          onClick={(event) => openCompactMenu("sort", event)}
        >
          <span aria-hidden="true">↕</span>
        </button>
        {filterOptions.length > 0 && (
          <button
            type="button"
            className="compact-icon-button"
            aria-haspopup="menu"
            aria-expanded={compactMenu === "filter"}
            aria-controls={menuId}
            aria-label="Filter records"
            title="Filter records"
            onClick={(event) => openCompactMenu("filter", event)}
          >
            <span aria-hidden="true">≡</span>
          </button>
        )}
        {compactMenu && (
          <div
            ref={menuRef}
            id={menuId}
            className="record-utilities-menu"
            role="menu"
            tabIndex={-1}
            aria-label={compactMenu === "sort" ? "Sort records" : "Filter records"}
            onKeyDown={handleCompactMenuKeyDown}
          >
            {compactMenu === "sort" && (
              <>
                <p className="record-utilities-menu-heading">Sort by</p>
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={!sort}
                  onClick={() => {
                    onSort("");
                    closeCompactMenu();
                  }}
                >
                  Default order
                </button>
                {sortOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    role="menuitemradio"
                    aria-checked={sort === option.value}
                    onClick={() => {
                      onSort(option.value);
                      closeCompactMenu();
                    }}
                  >
                    {option.label}
                  </button>
                ))}
                <button
                  type="button"
                  role="menuitem"
                  className="secondary-button"
                  onClick={() => {
                    onDirection();
                    closeCompactMenu();
                  }}
                  disabled={!sort}
                  aria-label={
                    sort ? `Sort ${direction === "asc" ? "descending" : "ascending"}` : "Select a sort field first"
                  }
                >
                  {direction === "asc" ? "A–Z" : "Z–A"}
                </button>
              </>
            )}
            {compactMenu === "filter" && (
              <>
                <p className="record-utilities-menu-heading">Filter</p>
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={!filter}
                  onClick={() => {
                    onFilter("");
                    closeCompactMenu();
                  }}
                >
                  All records
                </button>
                {filterOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    role="menuitemradio"
                    aria-checked={filter === option}
                    onClick={() => {
                      onFilter(option);
                      closeCompactMenu();
                    }}
                  >
                    {option}
                  </button>
                ))}
              </>
            )}
            {(search || sort || filter) && (
              <button type="button" role="menuitem" className="secondary-button" onClick={clearQuery}>
                Clear filters
              </button>
            )}
          </div>
        )}
        <span className="record-utility-summary" role="status">
          {visibleCount ?? totalCount ?? 0} of {totalCount ?? visibleCount ?? 0} matching
        </span>
      </div>
    );
  }

  return (
    <div className="record-utilities" aria-label={`${label} utilities`}>
      <label>
        Search {label.toLowerCase()}
        <input
          type="search"
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          placeholder={`Search ${label.toLowerCase()}…`}
        />
      </label>
      <label>
        Sort by
        <select value={sort} onChange={(event) => onSort(event.target.value)}>
          <option value="">Default order</option>
          {sortOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        className="secondary-button"
        onClick={onDirection}
        disabled={!sort}
        aria-label={sort ? `Sort ${direction === "asc" ? "descending" : "ascending"}` : "Select a sort field first"}
      >
        {direction === "asc" ? "A–Z" : "Z–A"}
      </button>
      {filterOptions.length > 0 && (
        <label>
          Filter
          <select value={filter} onChange={(event) => onFilter(event.target.value)}>
            <option value="">All</option>
            {filterOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      )}
      {(search || sort || filter) && (
        <button
          type="button"
          className="secondary-button"
          onClick={() => {
            onSearch("");
            onSort("");
            onFilter("");
          }}
        >
          Clear filters
        </button>
      )}
      <span className="record-utility-summary" role="status">
        {visibleCount ?? totalCount ?? 0} of {totalCount ?? visibleCount ?? 0} matching
      </span>
    </div>
  );
}
