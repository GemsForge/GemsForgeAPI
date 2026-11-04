import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button, Tooltip, type TamaguiElement } from "tamagui";
import {
  ArrowLeft,
  Eye,
  Filter,
  LayoutGrid,
  List,
  Search,
  SlidersHorizontal,
  Table2,
  type LucideIcon,
} from "lucide-react";
import type { GalleryCardSize } from "./GalleryViewControls";
import type { TablePropertyConfigurationState, TablePropertyOption } from "./configuration";
import { TablePropertyControls } from "./PropertyControls";
import type { TableViewId } from "./types";
import { GemButton } from "@gemsforge/ui";

export interface TableSettingsMenuProps {
  viewId: TableViewId;
  onViewChange: (viewId: TableViewId) => void;
  properties?: readonly TablePropertyOption[];
  propertyConfiguration?: TablePropertyConfigurationState;
  sort?: string;
  sortOptions?: readonly { value: string; label: string }[];
  onSort?: (value: string) => void;
  direction?: "asc" | "desc";
  onDirection?: () => void;
  filter?: string;
  filterOptions?: readonly string[];
  onFilter?: (value: string) => void;
  groupBy?: string;
  groupOptions?: readonly { value: string; label: string }[];
  onGroupBy?: (value: string) => void;
  galleryCardSize?: GalleryCardSize;
  onGalleryCardSizeChange?: (value: GalleryCardSize) => void;
  galleryFillMedia?: boolean;
  onGalleryFillMediaChange?: (value: boolean) => void;
  galleryImageSource?: string;
  galleryImageOptions?: readonly { value: string; label: string }[];
  onGalleryImageSourceChange?: (value: string) => void;
  tableIcon?: string;
  tableIconOptions?: readonly { name: string; icon: LucideIcon }[];
  onTableIconChange?: (value: string) => void;
}

type Panel = "root" | "layout" | "sort" | "filter" | "group" | "gallery" | "icon";

const viewLabels: Record<TableViewId, string> = { table: "Table", list: "List", gallery: "Gallery" };

export function TableSettingsMenu({
  viewId,
  onViewChange,
  properties,
  propertyConfiguration,
  sort = "",
  sortOptions = [],
  onSort,
  direction = "asc",
  onDirection,
  filter = "",
  filterOptions = [],
  onFilter,
  groupBy = "",
  groupOptions = [],
  onGroupBy,
  galleryCardSize = "small",
  onGalleryCardSizeChange,
  galleryFillMedia = true,
  onGalleryFillMediaChange,
  galleryImageSource = "__canvas",
  galleryImageOptions = [],
  onGalleryImageSourceChange,
  tableIcon = "Folder",
  tableIconOptions = [],
  onTableIconChange,
}: TableSettingsMenuProps) {
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState<Panel>("root");
  const triggerRef = useRef<TamaguiElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousOpen = useRef(false);

  useEffect(() => {
    if (open && panel !== "root") dialogRef.current?.querySelector<HTMLElement>("button, input")?.focus();
    if (!open && previousOpen.current) triggerRef.current?.focus();
    previousOpen.current = open;
  }, [open, panel]);

  const close = () => {
    setOpen(false);
    setPanel("root");
  };
  const chooseView = (next: TableViewId) => {
    onViewChange(next);
    setPanel(next === "gallery" ? "gallery" : "root");
  };
  const title =
    panel === "root"
      ? "View settings"
      : panel === "layout"
        ? "Layout"
        : panel === "gallery"
          ? "Gallery layout"
          : panel === "icon"
            ? "Table icon"
            : panel === "sort"
              ? "Sort"
              : panel === "filter"
                ? "Filter"
                : "Group by";

  return (
    <div className="table-kit-settings" role="group" aria-label="Table settings">
      <Tooltip placement="top" delay={300}>
        <Tooltip.Trigger asChild>
          <Button
            ref={triggerRef}
            type="button"
            size="xs"
            color="$gemInk"
            backgroundColor="$gemPanel"
            borderColor="$gemPanelLight"
            borderWidth={1}
            borderRadius="$gemControl"
            className="compact-icon-button table-kit-settings-trigger"
            aria-label="View settings"
            aria-haspopup="dialog"
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          >
            <SlidersHorizontal size={16} aria-hidden="true" />
          </Button>
        </Tooltip.Trigger>
        <Tooltip.Content className="table-kit-tooltip">
          <Tooltip.Arrow />
          <span>View settings</span>
        </Tooltip.Content>
      </Tooltip>
      {open && (
        <div
          ref={dialogRef}
          className="table-kit-settings-panel"
          role="dialog"
          aria-modal="false"
          aria-label={title}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.stopPropagation();
              if (panel === "root") close();
              else setPanel("root");
            }
          }}
        >
          <div className="table-kit-settings-heading">
            {panel !== "root" && (
              <GemButton
                size="xs"
                variant="quiet"
                tone="secondary"
                aria-label="Back to view settings"
                onClick={() => setPanel("root")}
              >
                <ArrowLeft size={18} aria-hidden="true" />
              </GemButton>
            )}
            <h2>{title}</h2>
            <GemButton size="xs" variant="quiet" tone="secondary" aria-label="Close view settings" onClick={close}>
              ×
            </GemButton>
          </div>
          {panel === "root" ? (
            <>
              <button type="button" className="table-kit-settings-row table-kit-settings-view-name" disabled>
                <SlidersHorizontal size={18} aria-hidden="true" />
                <span>Current view</span>
                <strong>{viewLabels[viewId]}</strong>
              </button>
              {onTableIconChange && tableIconOptions.length > 0 && (
                <SettingsRow
                  icon={<SlidersHorizontal size={18} aria-hidden="true" />}
                  label="Table icon"
                  value={tableIcon}
                  onClick={() => setPanel("icon")}
                />
              )}
              <SettingsRow
                icon={<LayoutGrid size={18} aria-hidden="true" />}
                label="Layout"
                value={viewLabels[viewId]}
                onClick={() => setPanel("layout")}
              />
              {propertyConfiguration && properties && (
                <SettingsRow
                  icon={<Eye size={18} aria-hidden="true" />}
                  label="Property visibility"
                  value={String(propertyConfiguration.visibleIds.length)}
                  onClick={() => setPanel("layout")}
                />
              )}
              {onFilter && (
                <SettingsRow
                  icon={<Filter size={18} aria-hidden="true" />}
                  label="Filter"
                  value={filter ? "Active" : "Add filter"}
                  onClick={() => setPanel("filter")}
                />
              )}
              {onSort && (
                <SettingsRow
                  icon={<Search size={18} aria-hidden="true" />}
                  label="Sort"
                  value={sort ? (sortOptions.find((option) => option.value === sort)?.label ?? sort) : "Default"}
                  onClick={() => setPanel("sort")}
                />
              )}
              {onGroupBy && (
                <SettingsRow
                  icon={<List size={18} aria-hidden="true" />}
                  label="Group"
                  value={groupBy ? (groupOptions.find((option) => option.value === groupBy)?.label ?? groupBy) : "None"}
                  onClick={() => setPanel("group")}
                />
              )}
            </>
          ) : panel === "layout" ? (
            <>
              <div className="table-kit-settings-choice-list" role="radiogroup" aria-label="Layout">
                {(Object.keys(viewLabels) as TableViewId[]).map((id) => (
                  <ChoiceRow
                    key={id}
                    label={viewLabels[id]}
                    selected={viewId === id}
                    onClick={() => chooseView(id)}
                    icon={
                      id === "table" ? (
                        <Table2 size={18} aria-hidden="true" />
                      ) : id === "list" ? (
                        <List size={18} aria-hidden="true" />
                      ) : (
                        <LayoutGrid size={18} aria-hidden="true" />
                      )
                    }
                  />
                ))}
              </div>
              {properties && propertyConfiguration && (
                <div className="table-kit-settings-subcontrol">
                  <TablePropertyControls
                    properties={properties}
                    configuration={propertyConfiguration}
                    label="Property visibility"
                    wireframe
                    inline
                  />
                </div>
              )}
              {viewId === "gallery" && (
                <SettingsRow
                  icon={<LayoutGrid size={18} aria-hidden="true" />}
                  label="Gallery layout"
                  value="Card preview"
                  onClick={() => setPanel("gallery")}
                />
              )}
            </>
          ) : panel === "gallery" ? (
            <>
              {onGalleryImageSourceChange && galleryImageOptions.length > 0 && (
                <label className="table-kit-settings-field">
                  Card image
                  <select
                    aria-label="Card image"
                    value={galleryImageSource}
                    onChange={(event) => onGalleryImageSourceChange(event.target.value)}
                  >
                    {galleryImageOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="table-kit-settings-field">
                Card size
                <select
                  value={galleryCardSize}
                  onChange={(event) => onGalleryCardSizeChange?.(event.target.value as GalleryCardSize)}
                >
                  <option value="small">Small</option>
                  <option value="medium">Medium</option>
                  <option value="large">Large</option>
                </select>
              </label>
              <label className="table-kit-settings-switch">
                <input
                  type="checkbox"
                  checked={galleryFillMedia}
                  onChange={(event) => onGalleryFillMediaChange?.(event.target.checked)}
                />{" "}
                <span>Fit media to card</span>
              </label>
            </>
          ) : panel === "icon" ? (
            <div className="table-kit-icon-picker" role="radiogroup" aria-label="Table icon">
              {tableIconOptions.map(({ name, icon: Icon }) => (
                <Tooltip key={name} placement="top" delay={250}>
                  <Tooltip.Trigger asChild>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={tableIcon === name}
                      aria-label={name}
                      className="table-kit-icon-choice"
                      onClick={() => onTableIconChange?.(name)}
                    >
                      <Icon size={18} aria-hidden="true" />
                    </button>
                  </Tooltip.Trigger>
                  <Tooltip.Content className="table-kit-tooltip">
                    <Tooltip.Arrow />
                    <span>{name}</span>
                  </Tooltip.Content>
                </Tooltip>
              ))}
            </div>
          ) : (
            <div className="table-kit-settings-choice-list" role="radiogroup" aria-label={title}>
              {panel === "sort" && (
                <ChoiceRow
                  label="Default order"
                  selected={!sort}
                  onClick={() => {
                    onSort?.("");
                    setPanel("root");
                  }}
                />
              )}
              {panel === "sort" &&
                sortOptions.map((option) => (
                  <ChoiceRow
                    key={option.value}
                    label={option.label}
                    selected={sort === option.value}
                    onClick={() => {
                      onSort?.(option.value);
                      setPanel("root");
                    }}
                  />
                ))}
              {panel === "sort" && sort && (
                <ChoiceRow
                  label={direction === "asc" ? "Ascending" : "Descending"}
                  selected={false}
                  onClick={onDirection}
                />
              )}
              {panel === "filter" && (
                <ChoiceRow
                  label="All records"
                  selected={!filter}
                  onClick={() => {
                    onFilter?.("");
                    setPanel("root");
                  }}
                />
              )}
              {panel === "filter" &&
                filterOptions.map((option) => (
                  <ChoiceRow
                    key={option}
                    label={option}
                    selected={filter === option}
                    onClick={() => {
                      onFilter?.(option);
                      setPanel("root");
                    }}
                  />
                ))}
              {panel === "group" && (
                <ChoiceRow
                  label="None"
                  selected={!groupBy}
                  onClick={() => {
                    onGroupBy?.("");
                    setPanel("root");
                  }}
                />
              )}
              {panel === "group" &&
                groupOptions.map((option) => (
                  <ChoiceRow
                    key={option.value}
                    label={option.label}
                    selected={groupBy === option.value}
                    onClick={() => {
                      onGroupBy?.(option.value);
                      setPanel("root");
                    }}
                  />
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SettingsRow({
  icon,
  label,
  value,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  value?: string;
  onClick: () => void;
}) {
  return (
    <button type="button" aria-label={label} className="table-kit-settings-row" onClick={onClick}>
      {icon}
      <span>{label}</span>
      {value && <strong>{value}</strong>}
      <span aria-hidden="true">›</span>
    </button>
  );
}

function ChoiceRow({
  icon,
  label,
  selected,
  onClick,
}: {
  icon?: ReactNode;
  label: string;
  selected: boolean;
  onClick?: () => void;
}) {
  return (
    <button type="button" role="radio" aria-checked={selected} className="table-kit-settings-choice" onClick={onClick}>
      {icon}
      <span>{label}</span>
      <span aria-hidden="true">{selected ? "✓" : ""}</span>
    </button>
  );
}
