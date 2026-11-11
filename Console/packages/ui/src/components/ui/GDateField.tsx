import dayjs, { type Dayjs } from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import { useEffect, useId, useMemo, useRef, useState, type ComponentProps } from "react";
import { Button, Input, Label, Popover, SizableText, XStack, YStack } from "tamagui";
import type { GemTextFieldWidth } from "./GemTextField";
import type { GemDateFormat } from "../../presentationTypes";
import { GSwitch } from "./GSwitch";
import { GemFieldDisplayValue } from "./fieldPrimitives";
import type { GemFieldDensity, GemFieldTextRole } from "./fieldPrimitives";
import { GemCaption } from "./GemTypography";

dayjs.extend(customParseFormat);
const calendarDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Props for the standard GemsForge calendar picker. */
export interface GDateFieldProps extends Omit<
  ComponentProps<typeof Input>,
  "value" | "defaultValue" | "onChange" | "onBlur"
> {
  label: string;
  showLabel?: boolean;
  value?: string;
  editing?: boolean;
  displayValue?: string;
  valueTextRole?: GemFieldTextRole;
  density?: GemFieldDensity;
  onDisplayClick?: () => void;
  format?: string;
  error?: string;
  required?: boolean;
  width?: GemTextFieldWidth;
  onBlur?: () => void;
  onChange?: (value: string) => void;
  displayFormat?: GemDateFormat;
  includeTime?: boolean;
  onDateConfigChange?: (config: { displayFormat: GemDateFormat; includeTime: boolean }) => void;
  /** Uses the light workspace surface for controls and portaled calendar content. */
  wireframe?: boolean;
}

function parseDate(value: string | undefined, format: string): Dayjs | null {
  if (!value) return null;
  const formats = [...new Set([format, "YYYY-MM-DD", "M/D/YYYY", "MM/DD/YYYY", "MMM D, YYYY", "MMMM D, YYYY"])].filter(
    Boolean,
  );
  for (const candidate of formats) {
    const parsed = dayjs(value, candidate, true);
    if (parsed.isValid()) return parsed;
  }
  return null;
}

/** Render the standard GemsForge calendar picker with Day.js date formatting. */
export function GDateField({
  label,
  showLabel = true,
  value = "",
  editing = true,
  displayValue,
  valueTextRole = "body",
  density = "standard",
  onDisplayClick,
  format = "YYYY-MM-DD",
  error,
  required = false,
  width = "long",
  onBlur,
  onChange,
  displayFormat = "iso",
  includeTime = false,
  onDateConfigChange,
  wireframe = false,
}: GDateFieldProps) {
  const selectedDate = parseDate(value, format);
  const [open, setOpen] = useState(false);
  const [formatMenuOpen, setFormatMenuOpen] = useState(false);
  const [dateDraft, setDateDraft] = useState(value);
  const [selectedFormat, setSelectedFormat] = useState<GemDateFormat>(displayFormat);
  const [selectedIncludeTime, setSelectedIncludeTime] = useState(includeTime);
  const previousDisplayFormat = useRef(displayFormat);
  const previousIncludeTime = useRef(includeTime);
  const [visibleMonth, setVisibleMonth] = useState(() => selectedDate ?? dayjs());
  const id = `g-date-${useId()}-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  const errorID = `${id}-error`;
  const formatLabels: Record<GemDateFormat, string> = {
    iso: "Year/Month/Day",
    local: "Full date",
    relative: "Relative",
  };
  const displayDateText = selectedDate
    ? selectedDate.format(selectedFormat === "local" ? "MMM D, YYYY" : selectedFormat === "relative" ? "MMM D" : format)
    : `Select ${label.toLowerCase()}…`;
  useEffect(() => {
    setDateDraft(selectedDate?.format(format) ?? value);
  }, [format, selectedDate?.valueOf(), value]);
  useEffect(() => {
    if (previousDisplayFormat.current !== displayFormat) {
      previousDisplayFormat.current = displayFormat;
      setSelectedFormat(displayFormat);
    }
  }, [displayFormat]);
  useEffect(() => {
    if (previousIncludeTime.current !== includeTime) {
      previousIncludeTime.current = includeTime;
      setSelectedIncludeTime(includeTime);
    }
  }, [includeTime]);
  const days = useMemo(() => {
    const start = visibleMonth.startOf("month").startOf("week");
    return Array.from({ length: 42 }, (_, index) => start.add(index, "day"));
  }, [visibleMonth]);

  if (!editing) {
    return (
      <YStack className={`gem-field-display${density === "compact" ? " gem-field-density--compact" : ""}`} gap="$1">
        <Label
          id={`${id}-display-label`}
          className={showLabel ? "g-field-label" : "sr-only"}
          color="$gemGold"
          fontSize="$2"
          fontWeight="800"
          textTransform="uppercase"
        >
          {label}
        </Label>
        <GemFieldDisplayValue
          aria-describedby={`${id}-display-label`}
          onClick={onDisplayClick}
          textRole={valueTextRole}
        >
          {displayValue ?? (selectedDate ? displayDateText : "—")}
        </GemFieldDisplayValue>
      </YStack>
    );
  }

  return (
    <YStack className={`create-form-field${density === "compact" ? " gem-field-density--compact" : ""}`} gap="$1">
      {showLabel ? (
        <Label
          className="g-field-label"
          htmlFor={id}
          color="$gemGold"
          fontSize="$2"
          fontWeight="800"
          textTransform="uppercase"
        >
          {label}
          {required ? " *" : ""}
        </Label>
      ) : null}
      <Popover
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (nextOpen) {
            if (selectedDate) setVisibleMonth(selectedDate);
            setDateDraft(selectedDate?.format(format) ?? value);
          }
        }}
        placement="bottom-start"
      >
        <Popover.Trigger asChild>
          <Button
            id={id}
            className={`create-form-control create-form-control--${width}${density === "compact" ? " gem-field-control--compact" : ""}`}
            data-wireframe-field={wireframe ? "true" : undefined}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorID : undefined}
            aria-required={required}
            aria-label={showLabel ? undefined : label}
            fontSize={valueTextRole === "caption" ? "$1" : undefined}
            onBlur={onBlur}
            justifyContent="space-between"
            width="100%"
            paddingVertical={density === "compact" ? "$1" : undefined}
            paddingHorizontal={density === "compact" ? "$2" : undefined}
          >
            {valueTextRole === "caption" ? <GemCaption>{displayDateText}</GemCaption> : displayDateText}
          </Button>
        </Popover.Trigger>
        <Popover.Content
          className="gem-date-popover"
          data-wireframe-date={wireframe ? "true" : undefined}
          padding="$3"
          borderWidth={1}
          minWidth={280}
        >
          <YStack gap="$3">
            <XStack alignItems="center" justifyContent="space-between">
              <Button
                size="sm"
                aria-label="Previous month"
                onPress={() => setVisibleMonth((month) => month.subtract(1, "month"))}
              >
                ‹
              </Button>
              <SizableText fontWeight="700">{visibleMonth.format("MMMM YYYY")}</SizableText>
              <Button
                size="sm"
                aria-label="Next month"
                onPress={() => setVisibleMonth((month) => month.add(1, "month"))}
              >
                ›
              </Button>
            </XStack>
            <YStack gap="$1">
              <Label htmlFor={`${id}-typed-date`} fontSize="$2" fontWeight="600">
                Enter a date
              </Label>
              <Input
                id={`${id}-typed-date`}
                className="gem-date-text-input"
                data-wireframe-date={wireframe ? "true" : undefined}
                aria-label={`${label} date`}
                placeholder="YYYY-MM-DD or M/D/YYYY"
                value={dateDraft}
                onChange={(event) => {
                  const next = event.currentTarget.value;
                  setDateDraft(next);
                  const parsed = parseDate(next, format);
                  if (parsed) {
                    setVisibleMonth(parsed);
                    onChange?.(parsed.format(format));
                  }
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    const parsed = parseDate(dateDraft, format);
                    if (parsed) {
                      onChange?.(parsed.format(format));
                      setVisibleMonth(parsed);
                      setOpen(false);
                    }
                  }
                }}
              />
              <SizableText className="gem-date-format-hint" fontSize="$1">
                Type a date to jump the calendar and save it.
              </SizableText>
            </YStack>
            <XStack flexWrap="wrap">
              {calendarDays.map((day) => (
                <SizableText key={day} width="14.28%" textAlign="center" fontWeight="700">
                  {day}
                </SizableText>
              ))}
              {days.map((date) => {
                const isSelected = selectedDate?.isSame(date, "day") ?? false;
                return (
                  <Button
                    key={date.format("YYYY-MM-DD")}
                    className="gem-calendar-day"
                    size="sm"
                    width="14.28%"
                    theme={isSelected ? "brand" : undefined}
                    opacity={date.month() === visibleMonth.month() ? 1 : 0.45}
                    aria-label={date.format("dddd, MMMM D, YYYY")}
                    onPress={() => {
                      const next = date.format(format);
                      setDateDraft(next);
                      onChange?.(next);
                      setOpen(false);
                    }}
                  >
                    {date.date()}
                  </Button>
                );
              })}
            </XStack>
            <YStack className="gem-date-settings" gap="$1">
              <XStack justifyContent="space-between" alignItems="center">
                <SizableText>Date format</SizableText>
                <Button
                  size="sm"
                  variant="quiet"
                  aria-expanded={formatMenuOpen}
                  onPress={() => setFormatMenuOpen((isOpen) => !isOpen)}
                >
                  {formatLabels[selectedFormat]} {formatMenuOpen ? "⌄" : "›"}
                </Button>
              </XStack>
              {formatMenuOpen ? (
                <YStack
                  className="gem-date-format-options"
                  data-wireframe-date={wireframe ? "true" : undefined}
                  gap="$1"
                >
                  {(["local", "iso", "relative"] as GemDateFormat[]).map((option) => (
                    <Button
                      key={option}
                      size="sm"
                      justifyContent="space-between"
                      aria-pressed={selectedFormat === option}
                      backgroundColor={selectedFormat === option ? "$gemPanelLight" : "transparent"}
                      onPress={() => {
                        setSelectedFormat(option);
                        onDateConfigChange?.({ displayFormat: option, includeTime: selectedIncludeTime });
                        setFormatMenuOpen(false);
                      }}
                    >
                      {formatLabels[option]}
                      {selectedFormat === option ? " ✓" : ""}
                    </Button>
                  ))}
                </YStack>
              ) : null}
              <XStack justifyContent="space-between" alignItems="center">
                <SizableText>Include time</SizableText>
                <GSwitch
                  label="Include time"
                  showLabel={false}
                  compact
                  value={selectedIncludeTime}
                  // Tamagui's controlled onCheckedChange path can be swallowed
                  // when this switch is nested inside the date popover; keep
                  // the press fallback until that upstream behavior is fixed.
                  onPress={() => {
                    const checked = !selectedIncludeTime;
                    setSelectedIncludeTime(checked);
                    onDateConfigChange?.({ displayFormat: selectedFormat, includeTime: checked });
                  }}
                />
              </XStack>
            </YStack>
          </YStack>
        </Popover.Content>
      </Popover>
      {error && (
        <SizableText id={errorID} role="alert" color="$danger" fontSize="$1">
          {error}
        </SizableText>
      )}
    </YStack>
  );
}

/** Backward-compatible short name for the standard calendar picker. */
export const GDate = GDateField;
