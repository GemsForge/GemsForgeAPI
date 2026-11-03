import { useState, type ReactNode } from "react";
import { GemField } from "./GemField";
import { GCheckboxField } from "./GCheckboxField";
import { GDate } from "./GDateField";
import { GImageField } from "./GImageField";
import { GSelectField } from "./GSelectField";
import { GemStatusPill } from "./GemStatusPill";
import type { GemFieldWidth } from "./GemField";
import type { GemPrimitiveType } from "./primitiveFieldContracts";
import type { GemColorToken, GemDateFormat, GemNumberFormat, GemSelectOption } from "../../presentationTypes";
import type { GemFieldDensity, GemFieldTextRole } from "./fieldPrimitives";

export interface GemPrimitiveFieldProps {
  primitive: GemPrimitiveType;
  label: string;
  showLabel?: boolean;
  value?: string | number | boolean | null;
  editing?: boolean;
  displayValue?: ReactNode;
  valueTextRole?: GemFieldTextRole;
  density?: GemFieldDensity;
  onDisplayClick?: () => void;
  onChange?: (value: string | number | boolean | null) => void;
  onBlur?: () => void;
  onSave?: (value: string | number | boolean | null) => Promise<void> | void;
  onMediaChange?: (file: File | null) => void;
  options?: GemSelectOption[];
  colorToken?: GemColorToken;
  numberFormat?: GemNumberFormat;
  dateFormat?: GemDateFormat;
  includeTime?: boolean;
  onDateConfigChange?: (config: { displayFormat: GemDateFormat; includeTime: boolean }) => void;
  required?: boolean;
  nullable?: boolean;
  min?: number;
  max?: number;
  step?: number | string;
  placeholder?: string;
  multiline?: boolean;
  error?: string;
  width?: GemFieldWidth;
  wireframe?: boolean;
}

export function validatePrimitiveValue(
  primitive: GemPrimitiveType,
  value: string | number | boolean | null | undefined,
  options: { required?: boolean; nullable?: boolean; min?: number; max?: number; allowedValues?: string[] } = {},
): string | undefined {
  const empty = value === null || value === undefined || value === "";
  if (empty && options.required && !options.nullable) return `${primitive} is required.`;
  if (empty) return undefined;
  if (primitive === "number" && (typeof value !== "number" || Number.isNaN(value))) return "Enter a valid number.";
  if (primitive === "number" && typeof value === "number") {
    if (options.min !== undefined && value < options.min) return `Enter a number of at least ${options.min}.`;
    if (options.max !== undefined && value > options.max) return `Enter a number no greater than ${options.max}.`;
  }
  if (primitive === "email" && (typeof value !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)))
    return "Enter a valid email address.";
  if (primitive === "url" && (typeof value !== "string" || !/^https?:\/\//i.test(value))) return "Enter a valid URL.";
  if (primitive === "select" || primitive === "status") {
    if (typeof value !== "string" || !options.allowedValues?.includes(value)) return "Choose an available option.";
  }
  return undefined;
}

/** Routes one semantic primitive to its established G field contract. */
export function GemPrimitiveField({
  primitive,
  label,
  showLabel = true,
  value = null,
  editing = true,
  displayValue,
  valueTextRole = "body",
  density = "standard",
  onDisplayClick,
  onChange,
  onBlur,
  onSave,
  onMediaChange,
  options = [],
  colorToken,
  numberFormat,
  dateFormat: _dateFormat = "iso",
  includeTime,
  onDateConfigChange,
  required,
  nullable,
  min,
  max,
  step,
  placeholder,
  multiline,
  error,
  width = "long",
  wireframe = false,
}: GemPrimitiveFieldProps) {
  const [validationError, setValidationError] = useState<string>();
  const resolvedError = error ?? validationError;
  const selectOptions =
    nullable && !options.some((option) => option.value === "") ? [...options, { value: "", label: "—" }] : options;
  const emit = (next: string | number | boolean | null) => {
    const message = validatePrimitiveValue(primitive, next, {
      required,
      nullable,
      min,
      max,
      allowedValues: selectOptions.map((option) => option.value),
    });
    setValidationError(message);
    if (!message) {
      onChange?.(next);
      void onSave?.(next);
    }
  };

  if (primitive === "status" || primitive === "select") {
    const current = String(value ?? "");
    const selectedOption = selectOptions.find((option) => option.value === current);
    const selectedColorToken = colorToken ?? selectedOption?.colorToken;
    return (
      <GSelectField
        label={label}
        showLabel={showLabel}
        value={current}
        options={selectOptions}
        editing={editing}
        displayValue={
          displayValue ??
          (primitive === "status" ? (
            <GemStatusPill
              className={
                selectedColorToken
                  ? `primitive-status-pill primitive-status-pill--${selectedColorToken}`
                  : "primitive-status-pill"
              }
            >
              {current || "—"}
            </GemStatusPill>
          ) : undefined)
        }
        valueTextRole={valueTextRole}
        density={density}
        onDisplayClick={onDisplayClick}
        onChange={emit}
        onBlur={onBlur}
        primitive={primitive}
        required={required}
        width={width}
        error={resolvedError}
        wireframe={wireframe}
      />
    );
  }
  if (primitive === "id" && !editing) {
    return (
      <GemField
        label={label}
        value={String(value ?? "")}
        editing={false}
        displayValue={displayValue ?? String(value ?? "—")}
        valueTextRole={valueTextRole}
        density={density}
        primitive="text"
        type="text"
        width={width}
      />
    );
  }
  if (primitive === "date") {
    return (
      <GDate
        label={label}
        showLabel={showLabel}
        value={String(value ?? "")}
        editing={editing}
        displayValue={typeof displayValue === "string" ? displayValue : undefined}
        valueTextRole={valueTextRole}
        density={density}
        onDisplayClick={onDisplayClick}
        format="YYYY-MM-DD"
        displayFormat={_dateFormat}
        includeTime={includeTime}
        onDateConfigChange={onDateConfigChange}
        onChange={emit}
        onBlur={onBlur}
        required={required}
        width={width}
        wireframe={wireframe}
      />
    );
  }
  if (primitive === "checkbox") {
    return (
      <GCheckboxField
        label={label}
        value={Boolean(value)}
        onChange={emit}
        required={required}
        width={width}
        error={resolvedError}
      />
    );
  }
  if (primitive === "image" || primitive === "media") {
    return (
      <GImageField
        label={label}
        value={typeof value === "string" ? value : null}
        editing={editing}
        displayValue={displayValue}
        onDisplayClick={onDisplayClick}
        onChange={onMediaChange}
        error={resolvedError}
      />
    );
  }
  return (
    <GemField
      label={label}
      showLabel={showLabel}
      value={String(value ?? "")}
      editing={editing}
      displayValue={displayValue}
      valueTextRole={valueTextRole}
      density={density}
      onDisplayClick={onDisplayClick}
      primitive={
        primitive === "number" || primitive === "url" || primitive === "email" || primitive === "phone"
          ? primitive
          : "text"
      }
      type={
        primitive === "number"
          ? "number"
          : primitive === "url"
            ? "url"
            : primitive === "email"
              ? "email"
              : primitive === "phone"
                ? "tel"
                : "text"
      }
      min={min}
      max={max}
      step={step ?? (numberFormat === "currency" ? "0.01" : undefined)}
      placeholder={placeholder}
      multiline={multiline}
      required={required}
      width={width}
      error={resolvedError}
      onChange={(event) => onChange?.(event.currentTarget.value)}
      onBlur={(event) => {
        emit(
          primitive === "number"
            ? event.currentTarget.value === ""
              ? null
              : Number(event.currentTarget.value)
            : event.currentTarget.value,
        );
        onBlur?.();
      }}
    />
  );
}
