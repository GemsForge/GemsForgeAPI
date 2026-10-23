import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import { Button, Dialog, Tooltip, type TamaguiElement } from "tamagui";
import type { TableNewRecordUtilityProps } from "./types";

interface NewRecordUtilityComponentProps extends TableNewRecordUtilityProps {
  triggerRef: RefObject<TamaguiElement | null>;
  disabled?: boolean;
  pending?: boolean;
}

/**
 * Present consumer-owned create/import/paste workflows in Tamagui's modal Dialog.
 * Dialog owns dismissal and focus trapping; the selected operation owns its
 * form data and may close the modal through the supplied control.
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
  const isOpen = open ?? uncontrolledOpen;
  const wasOpen = useRef(isOpen);
  const selectedOption = options.find((option) => option.id === selectedId) ?? options[0];
  const activeDescription = selectedOption?.description ?? description;

  const setOpen = useCallback(
    (nextOpen: boolean) => {
      setUncontrolledOpen(nextOpen);
      onOpenChange?.(nextOpen);
    },
    [onOpenChange],
  );

  useEffect(() => {
    if (!isOpen) return;
    setSelectedId(options[0]?.id);
  }, [isOpen, options]);

  useEffect(() => {
    // Restore the compact trigger even when the consumer closes a controlled dialog.
    if (wasOpen.current && !isOpen) triggerRef.current?.focus();
    wasOpen.current = isOpen;
  }, [isOpen, triggerRef]);

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
    document
      .querySelectorAll<HTMLButtonElement>(".table-kit-new-record-utility [data-new-record-option]")
      [nextIndex]?.focus();
  };

  return (
    <Dialog open={isOpen} onOpenChange={setOpen} modal>
      <Tooltip placement="top" delay={300}>
        <Tooltip.Trigger asChild>
          <Dialog.Trigger asChild>
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
              disabled={disabled || pending}
            >
              <span aria-hidden="true">＋</span>
              <span className="sr-only">New record</span>
            </Button>
          </Dialog.Trigger>
        </Tooltip.Trigger>
        <Tooltip.Content className="table-kit-tooltip">
          <Tooltip.Arrow />
          <span>New record</span>
        </Tooltip.Content>
      </Tooltip>
      <Dialog.Portal>
        <Dialog.Overlay className="table-kit-utility-backdrop" />
        <Dialog.Content className="table-kit-new-record-utility">
          <div className="table-kit-new-record-heading">
            <div>
              <Dialog.Title>{title}</Dialog.Title>
            </div>
            <Dialog.Close asChild>
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
              >
                ×
              </Button>
            </Dialog.Close>
          </div>
          <div className="table-kit-new-record-description">
            <Dialog.Description>{activeDescription}</Dialog.Description>
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
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}
