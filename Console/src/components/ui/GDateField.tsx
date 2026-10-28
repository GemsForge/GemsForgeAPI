import dayjs, { type Dayjs } from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import { useEffect, useMemo, useRef, useState, type ComponentProps } from "react";
import { Button, Input, Label, Popover, SizableText, XStack, YStack } from "tamagui";
import type { GemTextFieldWidth } from "./GemTextField";
import type { RecordDateFormat } from "../../table-kit/recordContracts";
import { GSwitch } from "./GSwitch";

dayjs.extend(customParseFormat);
const calendarDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Props for the standard GemsForge calendar picker. */
export interface GDateFieldProps extends Omit<ComponentProps<typeof Input>, "value" | "defaultValue" | "onChange"> {
  label: string;
  value?: string;
  editing?: boolean;
  displayValue?: string;
  onDisplayClick?: () => void;
  format?: string;
  error?: string;
  required?: boolean;
  width?: GemTextFieldWidth;
  onChange?: (value: string) => void;
  displayFormat?: RecordDateFormat;
  includeTime?: boolean;
  onDateConfigChange?: (config: { displayFormat: RecordDateFormat; includeTime: boolean }) => void;
}

function parseDate(value: string | undefined, format: string): Dayjs | null {
  if (!value) return null;
  const parsed = dayjs(value, format, true);
  return parsed.isValid() ? parsed : null;
}

/** Render the standard GemsForge calendar picker with Day.js date formatting. */
export function GDateField({
  label,
  value = "",
  editing = true,
  displayValue,
  onDisplayClick,
  format = "YYYY-MM-DD",
  error,
  required = false,
  width = "long",
  onChange,
  displayFormat = "iso",
  includeTime = false,
  onDateConfigChange,
}: GDateFieldProps) {
  const selectedDate = parseDate(value, format);
  const [open, setOpen] = useState(false);
  const [formatMenuOpen, setFormatMenuOpen] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<RecordDateFormat>(displayFormat);
  const [selectedIncludeTime, setSelectedIncludeTime] = useState(includeTime);
  const previousDisplayFormat = useRef(displayFormat);
  const previousIncludeTime = useRef(includeTime);
  const [visibleMonth, setVisibleMonth] = useState(() => selectedDate ?? dayjs());
  const id = `g-date-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  const errorID = `${id}-error`;
  const formatLabels: Record<RecordDateFormat, string> = {
    iso: "Year/Month/Day",
    local: "Full date",
    relative: "Relative",
  };
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
      <YStack className="gem-field-display" gap="$1">
        <Label className="g-field-label" color="$gemGold" fontSize="$2" fontWeight="800" textTransform="uppercase">
          {label}
        </Label>
        <button type="button" className="gem-field-display-value" onClick={onDisplayClick}>
          {displayValue ?? (selectedDate ? selectedDate.format(selectedFormat === "local" ? "MMM D, YYYY" : selectedFormat === "relative" ? "MMM D" : format) : "—")}
        </button>
      </YStack>
    );
  }

  return (
    <YStack className="create-form-field" gap="$1">
          <Label className="g-field-label" htmlFor={id} color="$gemGold" fontSize="$2" fontWeight="800" textTransform="uppercase">
        {label}
        {required ? " *" : ""}
      </Label>
      <Popover open={open} onOpenChange={setOpen} placement="bottom-start">
        <Popover.Trigger asChild>
          <Button
            id={id}
            className={`create-form-control create-form-control--${width}`}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorID : undefined}
            aria-required={required}
            justifyContent="space-between"
            width="100%"
          >
            {selectedDate ? selectedDate.format(selectedFormat === "local" ? "MMM D, YYYY" : selectedFormat === "relative" ? "MMM D" : format) : `Select ${label.toLowerCase()}…`}
          </Button>
        </Popover.Trigger>
        <Popover.Content className="gem-date-popover" padding="$3" borderWidth={1} minWidth={280}>
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
                      onChange?.(date.format(format));
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
                <Popover open={formatMenuOpen} onOpenChange={setFormatMenuOpen} placement="left-start">
                  <Popover.Trigger asChild>
                    <Button size="sm" chromeless>{formatLabels[selectedFormat]} ›</Button>
                  </Popover.Trigger>
                  <Popover.Content className="gem-date-format-popover" padding="$2" borderWidth={1}>
                    <YStack>
                      {(["local", "iso", "relative"] as RecordDateFormat[]).map((option) => (
                        <Button
                          key={option}
                          size="sm"
                          justifyContent="space-between"
                          backgroundColor={selectedFormat === option ? "$gemPanelLight" : "transparent"}
                          onPress={() => {
                            setSelectedFormat(option);
                            onDateConfigChange?.({ displayFormat: option, includeTime: selectedIncludeTime });
                            setFormatMenuOpen(false);
                          }}
                        >
                          {formatLabels[option]}{selectedFormat === option ? " ✓" : ""}
                        </Button>
                      ))}
                    </YStack>
                  </Popover.Content>
                </Popover>
              </XStack>
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
        <SizableText id={errorID} role="alert" color="$gemDanger" fontSize="$1">
          {error}
        </SizableText>
      )}
    </YStack>
  );
}

/** Backward-compatible short name for the standard calendar picker. */
export const GDate = GDateField;
