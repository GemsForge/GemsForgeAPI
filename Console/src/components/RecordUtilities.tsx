import { useEffect, useRef, useState } from "react";
import { Button, Menu, Tooltip, type TamaguiElement } from "tamagui";
import type { RecordSortDirection } from "../hooks/useRecordUtilities";

type CompactUtilityMenu = "sort" | "filter" | null;

/** Render record query actions with Tamagui's compact xs button contract. */
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
  const searchRef = useRef<HTMLInputElement>(null);
  const sortTriggerRef = useRef<TamaguiElement>(null);
  const filterTriggerRef = useRef<TamaguiElement>(null);
  const previousCompactMenu = useRef<CompactUtilityMenu>(null);
  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);
  useEffect(() => {
    if (previousCompactMenu.current && !compactMenu) {
      (previousCompactMenu.current === "sort" ? sortTriggerRef : filterTriggerRef).current?.focus();
    }
    previousCompactMenu.current = compactMenu;
  }, [compactMenu]);

  if (compact) {
    const clearQuery = () => {
      onSearch("");
      onSort("");
      onFilter("");
    };

    return (
      <div className="record-utilities record-utilities-compact" aria-label={`${label} utilities`}>
        <Menu
          open={compactMenu === "sort"}
          onOpenChange={(open) => setCompactMenu(open ? "sort" : null)}
          placement="bottom-start"
          modal={false}
        >
          <Tooltip placement="top" delay={300}>
            <Tooltip.Trigger asChild>
              <Button
                ref={sortTriggerRef}
                type="button"
                size="xs"
                color="$gemInk"
                backgroundColor="$gemPanel"
                borderColor="$gemPanelLight"
                borderWidth={1}
                borderRadius="$gemControl"
                className="compact-icon-button"
                aria-label="Sort records"
                onClick={() => setCompactMenu((current) => (current === "sort" ? null : "sort"))}
              >
                <span aria-hidden="true">↕</span>
              </Button>
            </Tooltip.Trigger>
            <Tooltip.Content className="table-kit-tooltip">
              <Tooltip.Arrow />
              <span>Sort records</span>
            </Tooltip.Content>
          </Tooltip>
          <Menu.Portal zIndex={20}>
            <Menu.Content className="record-utilities-menu" aria-label="Sort records" loop>
              <Menu.Label>Sort by</Menu.Label>
              <Menu.RadioGroup
                value={sort || "__default"}
                onValueChange={(value) => {
                  onSort(value === "__default" ? "" : value);
                  setCompactMenu(null);
                }}
              >
                <Menu.RadioItem value="__default" textValue="Default order">
                  <Menu.ItemIndicator />
                  <Menu.ItemTitle>Default order</Menu.ItemTitle>
                </Menu.RadioItem>
                {sortOptions.map((option) => (
                  <Menu.RadioItem key={option.value} value={option.value} textValue={option.label}>
                    <Menu.ItemIndicator />
                    <Menu.ItemTitle>{option.label}</Menu.ItemTitle>
                  </Menu.RadioItem>
                ))}
              </Menu.RadioGroup>
              <Menu.Item disabled={!sort} onSelect={onDirection} textValue="Change sort direction">
                <Menu.ItemTitle>{direction === "asc" ? "A–Z" : "Z–A"}</Menu.ItemTitle>
              </Menu.Item>
              {(search || sort || filter) && (
                <Menu.Item onSelect={clearQuery} textValue="Clear filters">
                  <Menu.ItemTitle>Clear filters</Menu.ItemTitle>
                </Menu.Item>
              )}
            </Menu.Content>
          </Menu.Portal>
        </Menu>
        {filterOptions.length > 0 && (
          <Menu
            open={compactMenu === "filter"}
            onOpenChange={(open) => setCompactMenu(open ? "filter" : null)}
            placement="bottom-start"
            modal={false}
          >
            <Tooltip placement="top" delay={300}>
              <Tooltip.Trigger asChild>
                <Button
                  ref={filterTriggerRef}
                  type="button"
                  size="xs"
                  color="$gemInk"
                  backgroundColor="$gemPanel"
                  borderColor="$gemPanelLight"
                  borderWidth={1}
                  borderRadius="$gemControl"
                  className="compact-icon-button"
                  aria-label="Filter records"
                  onClick={() => setCompactMenu((current) => (current === "filter" ? null : "filter"))}
                >
                  <span aria-hidden="true">≡</span>
                </Button>
              </Tooltip.Trigger>
              <Tooltip.Content className="table-kit-tooltip">
                <Tooltip.Arrow />
                <span>Filter records</span>
              </Tooltip.Content>
            </Tooltip>
            <Menu.Portal zIndex={20}>
              <Menu.Content className="record-utilities-menu" aria-label="Filter records" loop>
                <Menu.Label>Filter</Menu.Label>
                <Menu.RadioGroup
                  value={filter || "__all"}
                  onValueChange={(value) => {
                    onFilter(value === "__all" ? "" : value);
                    setCompactMenu(null);
                  }}
                >
                  <Menu.RadioItem value="__all" textValue="All records">
                    <Menu.ItemIndicator />
                    <Menu.ItemTitle>All records</Menu.ItemTitle>
                  </Menu.RadioItem>
                  {filterOptions.map((option) => (
                    <Menu.RadioItem key={option} value={option} textValue={option}>
                      <Menu.ItemIndicator />
                      <Menu.ItemTitle>{option}</Menu.ItemTitle>
                    </Menu.RadioItem>
                  ))}
                </Menu.RadioGroup>
                {(search || sort || filter) && (
                  <Menu.Item onSelect={clearQuery} textValue="Clear filters">
                    <Menu.ItemTitle>Clear filters</Menu.ItemTitle>
                  </Menu.Item>
                )}
              </Menu.Content>
            </Menu.Portal>
          </Menu>
        )}
        <span className="record-utility-summary" role="status">
          {search.trim()
            ? `${visibleCount ?? totalCount ?? 0} of ${totalCount ?? visibleCount ?? 0} matching`
            : `${visibleCount ?? totalCount ?? 0} records`}
        </span>
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
        <Tooltip placement="top" delay={300}>
          <Tooltip.Trigger asChild>
            <Button
              type="button"
              size="xs"
              color="$gemInk"
              backgroundColor="$gemPanel"
              borderColor="$gemPanelLight"
              borderWidth={1}
              borderRadius="$gemControl"
              className="compact-icon-button"
              aria-label={searchOpen ? "Close search" : `Search ${label.toLowerCase()}`}
              onClick={() => setSearchOpen((open) => !open)}
            >
              <span aria-hidden="true">⌕</span>
            </Button>
          </Tooltip.Trigger>
          <Tooltip.Content className="table-kit-tooltip">
            <Tooltip.Arrow />
            <span>{searchOpen ? "Close search" : `Search ${label.toLowerCase()}`}</span>
          </Tooltip.Content>
        </Tooltip>
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
      <Button
        type="button"
        size="xs"
        color="$gemInk"
        backgroundColor="$gemPanel"
        borderColor="$gemPanelLight"
        borderWidth={1}
        borderRadius="$gemControl"
        className="secondary-button"
        onClick={onDirection}
        disabled={!sort}
        aria-label={sort ? `Sort ${direction === "asc" ? "descending" : "ascending"}` : "Select a sort field first"}
      >
        {direction === "asc" ? "A–Z" : "Z–A"}
      </Button>
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
        <Button
          type="button"
          size="xs"
          color="$gemInk"
          backgroundColor="$gemPanel"
          borderColor="$gemPanelLight"
          borderWidth={1}
          borderRadius="$gemControl"
          className="secondary-button"
          onClick={() => {
            onSearch("");
            onSort("");
            onFilter("");
          }}
        >
          Clear filters
        </Button>
      )}
      <span className="record-utility-summary" role="status">
        {search.trim()
          ? `${visibleCount ?? totalCount ?? 0} of ${totalCount ?? visibleCount ?? 0} matching`
          : `${visibleCount ?? totalCount ?? 0} records`}
      </span>
    </div>
  );
}
