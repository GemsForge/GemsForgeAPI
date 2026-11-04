import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import { Dialog, SizableText, Tooltip, YStack, type TamaguiElement } from "tamagui";
import { GemButton } from "@gemsforge/ui";
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
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();
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
    setSelectedId((current) => {
      if (!wasOpen.current) return options[0]?.id;
      return options.some((option) => option.id === current) ? current : options[0]?.id;
    });
  }, [isOpen, options]);

  useEffect(() => {
    // Restore the compact trigger even when the consumer closes a controlled dialog.
    if (wasOpen.current && !isOpen) triggerRef.current?.focus();
    wasOpen.current = isOpen;
  }, [isOpen, triggerRef]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpen(false);
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
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
    const optionButtons = document.querySelectorAll<HTMLButtonElement>(
      ".table-kit-new-record-utility [data-new-record-option]",
    );
    optionButtons[nextIndex]?.focus();
  };

  return (
    <Dialog open={isOpen} onOpenChange={setOpen} modal>
      <Tooltip placement="top" delay={300}>
        <Tooltip.Trigger asChild>
          <GemButton
            ref={triggerRef}
            type="button"
            size="xs"
            className="compact-icon-button wireframe-design-button"
            tone="wireframe"
            variant="outlined"
            aria-label="New record"
            aria-haspopup="dialog"
            aria-expanded={isOpen}
            disabled={disabled || pending}
            onClick={() => setOpen(true)}
          >
            <span aria-hidden="true">＋</span>
            <span className="sr-only">New record</span>
          </GemButton>
        </Tooltip.Trigger>
        <Tooltip.Content className="table-kit-tooltip">
          <Tooltip.Arrow />
          <span>New record</span>
        </Tooltip.Content>
      </Tooltip>
      {isOpen && (
        <div className="table-kit-utility-backdrop table-kit-new-record-backdrop" role="presentation">
          <YStack
            ref={(element) => {
              dialogRef.current = element as unknown as HTMLDivElement | null;
            }}
            className="table-kit-new-record-utility"
            style={{ backgroundColor: "var(--panel)" }}
            borderColor="$borderColor"
            borderWidth={1}
            borderRadius="$gemCard"
            color="$color"
            role="dialog"
            aria-modal={true}
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
          >
            <div className="table-kit-new-record-heading">
              <div>
                <SizableText
                  id={titleId}
                  className="table-kit-new-record-title"
                  role="heading"
                  aria-level={2}
                  size="$4"
                  fontWeight="700"
                >
                  {title}
                </SizableText>
                <SizableText
                  id={descriptionId}
                  className="table-kit-new-record-description"
                  size="$2"
                  color="$color"
                  opacity={0.75}
                >
                  {activeDescription}
                </SizableText>
              </div>
              <GemButton
                type="button"
                size="xs"
                tone="secondary"
                variant="quiet"
                aria-label="Close new record utility"
                onClick={() => setOpen(false)}
              >
                ×
              </GemButton>
            </div>
            <div className="table-kit-new-record-options" role="tablist" aria-label="New record operations">
              {options.map((option, index) => (
                <GemButton
                  key={option.id}
                  type="button"
                  size="sm"
                  className="table-kit-new-record-option-button"
                  color="$gemCanvas"
                  tone={option.id === selectedOption?.id ? "primary" : "secondary"}
                  variant="outlined"
                  data-new-record-option
                  role="tab"
                  aria-selected={option.id === selectedOption?.id}
                  onClick={() => setSelectedId(option.id)}
                  onKeyDown={(event) => handleOptionKeyDown(event, index)}
                >
                  <SizableText className="table-kit-new-record-option-label" fontWeight="700">
                    {option.label}
                  </SizableText>
                </GemButton>
              ))}
            </div>
            {selectedOption && (
              <section className="table-kit-new-record-content" aria-label={`${selectedOption.label} workflow`}>
                {selectedOption.render({ close: () => setOpen(false) })}
              </section>
            )}
          </YStack>
        </div>
      )}
    </Dialog>
  );
}
