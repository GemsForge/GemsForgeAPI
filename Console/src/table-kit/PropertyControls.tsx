import { useEffect, useId, useRef, useState } from "react";
import { Button, Tooltip, type TamaguiElement } from "tamagui";
import { GCheckboxField, GSearchField } from "../components/ui";
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
  /** Maximum number of visible properties for a constrained renderer. */
  maxVisibleProperties?: number;
}

/** Render searchable, reorderable xs property controls without changing record data. */
export function TablePropertyControls({
  properties,
  configuration,
  label = "Properties",
  searchLabel = "Search properties",
  showAllLabel = "Show all",
  hideAllLabel = "Hide all",
  resetLabel = "Reset properties",
  maxVisibleProperties,
}: TablePropertyControlsProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const triggerRef = useRef<TamaguiElement>(null);
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

  /** Close the transient popover when focus moves to another feature or the page. */
  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      const triggerElement = triggerRef.current as unknown as HTMLElement | null;
      if (target instanceof Node && !dialogRef.current?.contains(target) && !triggerElement?.contains(target)) {
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  return (
    <div className="table-kit-property-controls" role="group" aria-label="Property configuration">
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
            className="table-kit-property-button compact-icon-button"
            aria-controls={dialogId}
            aria-haspopup="dialog"
            aria-expanded={open}
            onClick={() => setOpen((current) => !current)}
          >
            <span aria-hidden="true">⚙</span>
            <span className="sr-only">{label}</span>
          </Button>
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
          className="table-kit-property-dialog table-kit-popover-frame"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.stopPropagation();
              setOpen(false);
            }
          }}
        >
          <h2 id={dialogTitleId}>{label}</h2>
          {maxVisibleProperties !== undefined && (
            <p className="table-kit-property-limit" role="status">
              You can select up to {maxVisibleProperties} properties at a time.
            </p>
          )}
          <GSearchField
            label={undefined}
            aria-label={searchLabel}
            value={search}
            onChange={setSearch}
            placeholder={searchLabel}
            width="short"
          />
          <div role="toolbar" aria-label="Property actions">
            <Button
              size="xs"
              color="$gemInk"
              backgroundColor="$gemPanel"
              borderColor="$gemPanelLight"
              borderWidth={1}
              borderRadius="$gemControl"
              type="button"
              aria-label={showAllLabel}
              onClick={configuration.showAll}
            >
              {showAllLabel}
            </Button>
            <Button
              size="xs"
              color="$gemInk"
              backgroundColor="$gemPanel"
              borderColor="$gemPanelLight"
              borderWidth={1}
              borderRadius="$gemControl"
              type="button"
              onClick={configuration.hideAll}
            >
              {hideAllLabel}
            </Button>
            <Button
              size="xs"
              color="$gemInk"
              backgroundColor="$gemPanel"
              borderColor="$gemPanelLight"
              borderWidth={1}
              borderRadius="$gemControl"
              type="button"
              onClick={configuration.reset}
            >
              {resetLabel}
            </Button>
          </div>
          {configuration.missingPropertyIds.length > 0 && (
            <p role="status">Some saved properties are unavailable and were reset.</p>
          )}
          <ul aria-label="Properties">
            {filteredProperties.map((property) => {
              const visible = configuration.visibleIds.includes(property.id);
              return (
                <li key={property.id}>
                  <GCheckboxField
                    label={property.label}
                    value={visible}
                    onChange={(checked) => configuration.setVisibility(property.id, checked)}
                    width="long"
                  />
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
