import { useEffect, useId, useRef, useState } from "react";
import { Tooltip } from "tamagui";
import { filterTableProperties, type TablePropertyConfigurationState, type TablePropertyOption } from "./configuration";

/** Accessible property menu backed by the consumer-owned configuration state. */
export interface TablePropertyControlsProps {
  properties: readonly TablePropertyOption[];
  configuration: TablePropertyConfigurationState;
  label?: string;
  searchLabel?: string;
  showAllLabel?: string;
  hideAllLabel?: string;
  resetLabel?: string;
  /** Accessible name for the dialog close action. */
  closeLabel?: string;
}

/** Render searchable, reorderable property controls without changing record data. */
export function TablePropertyControls({
  properties,
  configuration,
  label = "Properties",
  searchLabel = "Search properties",
  showAllLabel = "Show all",
  hideAllLabel = "Hide all",
  resetLabel = "Reset properties",
  closeLabel = "Close properties",
}: TablePropertyControlsProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const dialogId = useId();
  const dialogTitleId = useId();
  const previousOpen = useRef(open);
  const filteredProperties = filterTableProperties(properties, search);
  const propertyById = new Map(properties.map((property) => [property.id, property]));

  useEffect(() => {
    if (open) {
      dialogRef.current?.querySelector<HTMLInputElement>('input[type="search"]')?.focus();
    } else if (previousOpen.current) {
      triggerRef.current?.focus();
    }
    previousOpen.current = open;
  }, [open]);

  return (
    <div className="table-kit-property-controls" role="group" aria-label="Property configuration">
      <Tooltip placement="top" delay={300}>
        <Tooltip.Trigger asChild>
          <button
            ref={triggerRef}
            type="button"
            className="table-kit-property-button compact-icon-button"
            aria-controls={dialogId}
            aria-haspopup="dialog"
            aria-expanded={open}
            onClick={() => setOpen((current) => !current)}
          >
            <span aria-hidden="true">⚙</span>
            <span className="sr-only">{label}</span>
          </button>
        </Tooltip.Trigger>
        <Tooltip.Content className="table-kit-tooltip">
          <Tooltip.Arrow />
          <span>{label}</span>
        </Tooltip.Content>
      </Tooltip>
      {open && (
        <div
          ref={dialogRef}
          id={dialogId}
          role="dialog"
          aria-labelledby={dialogTitleId}
          className="table-kit-property-dialog"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.stopPropagation();
              setOpen(false);
            }
          }}
        >
          <h2 id={dialogTitleId}>{label}</h2>
          <button type="button" aria-label={closeLabel} onClick={() => setOpen(false)}>
            {closeLabel}
          </button>
          <label>
            {searchLabel}
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={searchLabel}
            />
          </label>
          <div role="toolbar" aria-label="Property actions">
            <button type="button" onClick={configuration.showAll}>
              {showAllLabel}
            </button>
            <button type="button" onClick={configuration.hideAll}>
              {hideAllLabel}
            </button>
            <button type="button" onClick={configuration.reset}>
              {resetLabel}
            </button>
          </div>
          {configuration.missingPropertyIds.length > 0 && (
            <p role="status">Some saved properties are unavailable and were reset.</p>
          )}
          <ul aria-label="Properties">
            {filteredProperties.map((property) => {
              const index = configuration.configuration.order.indexOf(property.id);
              const visible = configuration.visibleIds.includes(property.id);
              return (
                <li key={property.id}>
                  <label>
                    <input
                      type="checkbox"
                      checked={visible}
                      onChange={(event) => configuration.setVisibility(property.id, event.target.checked)}
                    />
                    <span>{property.label}</span>
                  </label>
                  <button
                    type="button"
                    aria-label={`Move ${property.label} up`}
                    disabled={index <= 0}
                    onClick={() => configuration.move(property.id, "up")}
                  >
                    Move up
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${property.label} down`}
                    disabled={index < 0 || index >= configuration.configuration.order.length - 1}
                    onClick={() => configuration.move(property.id, "down")}
                  >
                    Move down
                  </button>
                </li>
              );
            })}
          </ul>
          {[...configuration.configuration.order]
            .filter((propertyId) => !propertyById.has(propertyId))
            .map((propertyId) => (
              <p key={propertyId} role="status">
                Property unavailable: {propertyId}
              </p>
            ))}
        </div>
      )}
    </div>
  );
}
