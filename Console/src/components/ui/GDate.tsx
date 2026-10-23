import dayjs, { type Dayjs } from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import { useMemo, useState } from "react";
import { Button, Label, Popover, SizableText, XStack, YStack } from "tamagui";
import type { GemFieldWidth } from "./GemField";

dayjs.extend(customParseFormat);
const calendarDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Props for the standard GemsForge calendar picker. */
export interface GDateProps {
  label: string;
  value?: string;
  format?: string;
  error?: string;
  required?: boolean;
  width?: GemFieldWidth;
  onChange?: (value: string) => void;
}

function parseDate(value: string | undefined, format: string): Dayjs | null {
  if (!value) return null;
  const parsed = dayjs(value, format, true);
  return parsed.isValid() ? parsed : null;
}

/** Render the standard GemsForge calendar picker with Day.js date formatting. */
export function GDate({ label, value = "", format = "YYYY-MM-DD", error, required = false, width = "long", onChange }: GDateProps) {
  const selectedDate = parseDate(value, format);
  const [open, setOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() => selectedDate ?? dayjs());
  const id = `g-date-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  const errorID = `${id}-error`;
  const days = useMemo(() => {
    const start = visibleMonth.startOf("month").startOf("week");
    return Array.from({ length: 42 }, (_, index) => start.add(index, "day"));
  }, [visibleMonth]);

  return (
    <YStack className={`create-form-control create-form-control--${width}`} gap="$1">
      <Label htmlFor={id} color="$gemMuted" fontSize="$2" fontWeight="700">{label}{required ? " *" : ""}</Label>
      <Popover open={open} onOpenChange={setOpen} placement="bottom-start">
        <Popover.Trigger asChild>
          <Button id={id} aria-invalid={Boolean(error)} aria-describedby={error ? errorID : undefined} aria-required={required} justifyContent="space-between" width="100%">
            {selectedDate ? selectedDate.format(format) : `Select ${label.toLowerCase()}…`}
          </Button>
        </Popover.Trigger>
        <Popover.Content padding="$3" bordered elevate minWidth={280}>
          <YStack gap="$3">
            <XStack alignItems="center" justifyContent="space-between">
              <Button size="$2" aria-label="Previous month" onPress={() => setVisibleMonth((month) => month.subtract(1, "month"))}>‹</Button>
              <SizableText fontWeight="700">{visibleMonth.format("MMMM YYYY")}</SizableText>
              <Button size="$2" aria-label="Next month" onPress={() => setVisibleMonth((month) => month.add(1, "month"))}>›</Button>
            </XStack>
            <XStack flexWrap="wrap">
              {calendarDays.map((day) => <SizableText key={day} width="14.28%" textAlign="center" fontWeight="700">{day}</SizableText>)}
              {days.map((date) => {
                const isSelected = selectedDate?.isSame(date, "day") ?? false;
                return <Button key={date.format("YYYY-MM-DD")} size="$2" width="14.28%" chromeless={!isSelected} theme={isSelected ? "brand" : undefined} opacity={date.month() === visibleMonth.month() ? 1 : 0.45} aria-label={date.format("dddd, MMMM D, YYYY")} onPress={() => { onChange?.(date.format(format)); setOpen(false); }}>{date.date()}</Button>;
              })}
            </XStack>
          </YStack>
        </Popover.Content>
      </Popover>
      {error && <SizableText id={errorID} role="alert" color="$gemDanger" fontSize="$1">{error}</SizableText>}
    </YStack>
  );
}
