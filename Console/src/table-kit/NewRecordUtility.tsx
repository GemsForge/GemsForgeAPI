import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import { Button, Tooltip, type TamaguiElement } from "tamagui";
import type { TableNewRecordUtilityProps } from "./types";

interface NewRecordUtilityComponentProps extends TableNewRecordUtilityProps {
  triggerRef: RefObject<TamaguiElement | null>;
  disabled?: boolean;
  pending?: boolean;
}

/**
 * Render the consumer-owned create/import/paste surface over the active table.
 * The utility owns only presentation state; the selected workflow owns data and
 * closes the surface through the supplied control. The compact header trigger
 * and dismissal affordance use Tamagui's xs button preset. Each operation is
 * an inline action, and its declarative statement becomes the active workflow
 * description so the panel always explains the action being presented.
 */
export function NewRecordUtility({
  title = "New record",
  description = "Choose an operation.",
  options,
  open,
  onOpenChange,
  triggerRef,
  disabled = false,
  pending = false,
}: NewRecordUtilityComponentProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(options[0]?.id);
  const dialogRef = useRef<HTMLDivElement>(null);
  const utilityId = useId();
  const titleId = `${utilityId}-title`;
  const descriptionId = `${utilityId}-description`;
  const isOpen = open ?? uncontrolledOpen;
  const selectedOption = options.find((option) => option.id === selectedId) ?? options[0];
  const activeDescription = selectedOption?.description ?? description;
  const wasOpen = useRef(isOpen);

  const setOpen = useCallback(
    (nextOpen: boolean) => {
      setUncontrolledOpen(nextOpen);
      onOpenChange?.(nextOpen);
    },
    [onOpenChange],
  );

  useEffect(() => {
    if (wasOpen.current && !isOpen) triggerRef.current?.focus();
    wasOpen.current = isOpen;
  }, [isOpen, triggerRef]);

  useEffect(() => {
    if (!isOpen) return;
    setSelectedId(options[0]?.id);
    dialogRef.current?.querySelector<HTMLButtonElement>("[data-new-record-option]")?.focus();
  }, [isOpen, options]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (!focusable.length) return;
      const currentIndex = focusable.indexOf(document.activeElement as HTMLElement);
      const nextIndex = event.shiftKey
        ? currentIndex <= 0
          ? focusable.length - 1
          : currentIndex - 1
        : currentIndex === focusable.length - 1
          ? 0
          : currentIndex + 1;
      if (currentIndex === -1 || nextIndex !== currentIndex + (event.shiftKey ? -1 : 1)) {
        event.preventDefault();
        focusable[nextIndex]?.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, setOpen]);

  const handleOptionKeyDown = (event: KeyboardEvent<HTMLElement>, index: number) => {
    if (!options.length || !["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const nextIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? options.length - 1
          : (index + (event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length;
    const next = options[nextIndex];
    setSelectedId(next.id);
    dialogRef.current?.querySelectorAll<HTMLButtonElement>("[data-new-record-option]")[nextIndex]?.focus();
  };

  return (
    <>
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
            className="compact-icon-button"
            aria-label="New record"
            aria-haspopup="dialog"
            aria-expanded={isOpen}
            disabled={disabled || pending}
            onClick={() => setOpen(true)}
          >
            <span aria-hidden="true">＋</span>
            <span className="sr-only">New record</span>
          </Button>
        </Tooltip.Trigger>
        <Tooltip.Content className="table-kit-tooltip">
          <Tooltip.Arrow />
          <span>New record</span>
        </Tooltip.Content>
      </Tooltip>
      {isOpen && (
        <div className="table-kit-utility-backdrop" role="presentation">
          <div
            ref={dialogRef}
            className="table-kit-new-record-utility"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
          >
            <div className="table-kit-new-record-heading">
              <div>
                <h2 id={titleId}>{title}</h2>
                <p id={descriptionId}>{activeDescription}</p>
              </div>
              <Button
                type="button"
                size="xs"
                color="$gemInk"
                backgroundColor="$gemPanel"
                borderColor="$gemPanelLight"
                borderWidth={1}
                borderRadius="$gemControl"
                className="secondary-button"
                aria-label="Close new record utility"
                onClick={() => setOpen(false)}
              >
                ×
              </Button>
            </div>
            <div className="table-kit-new-record-options" role="tablist" aria-label="New record operations">
              {options.map((option, index) => (
                <Button
                  key={option.id}
                  type="button"
                  size="sm"
                  color="$gemInk"
                  backgroundColor="$gemPanelLight"
                  borderColor="$gemPanelLight"
                  borderWidth={1}
                  borderRadius="$gemControl"
                  data-new-record-option
                  role="tab"
                  aria-selected={option.id === selectedOption?.id}
                  onClick={() => setSelectedId(option.id)}
                  onKeyDown={(event) => handleOptionKeyDown(event, index)}
                >
                  <strong>{option.label}</strong>
                </Button>
              ))}
            </div>
            {selectedOption && (
              <section className="table-kit-new-record-content" aria-label={`${selectedOption.label} workflow`}>
                {selectedOption.render({ close: () => setOpen(false) })}
              </section>
            )}
          </div>
        </div>
      )}
    </>
  );
}
