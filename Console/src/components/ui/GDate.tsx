import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import { forwardRef, type ComponentProps } from "react";
import { Input } from "tamagui";
import { GemField, type GemFieldWidth } from "./GemField";

dayjs.extend(customParseFormat);

/** Props for the reusable date field. Values are stored as date-only strings. */
export interface GDateProps extends Omit<ComponentProps<typeof Input>, "value" | "defaultValue" | "onChange"> {
  label: string;
  value?: string;
  format?: string;
  error?: string;
  required?: boolean;
  width?: GemFieldWidth;
  onChange?: (value: string) => void;
}

/** Render a reusable native calendar picker with Day.js normalization and a configurable date format. */
export const GDate = forwardRef<HTMLInputElement, GDateProps>(function GDate(
  { label, value = "", format = "YYYY-MM-DD", error, required = false, width = "long", onChange, ...props },
  ref,
) {
  const normalizedValue = value && dayjs(value, format, true).isValid() ? dayjs(value, format).format("YYYY-MM-DD") : value;

  return (
    <GemField
      {...props}
      ref={ref}
      label={label}
      type="date"
      value={normalizedValue}
      placeholder={format}
      error={error}
      required={required}
      width={width}
      onChange={(event) => onChange?.(event.currentTarget.value)}
    />
  );
});
