import { forwardRef, useId, type ComponentProps, type ReactNode } from "react";
import { Input } from "tamagui";
import type { GemPrimitiveType } from "./primitiveFieldContracts";
import type { GemFieldDensity, GemFieldTextRole } from "./fieldPrimitives";
import {
  GemFieldDisplayValue,
  GemFieldError,
  GemFieldLabel,
  GemFieldRoot,
  GemInput,
  GemTextArea,
} from "./fieldPrimitives";

/** Standard reusable field widths shared by generic and feature forms. */
export type GemFieldWidth = "xs" | "short" | "medium" | "long";
export type GemTextFieldWidth = GemFieldWidth;

export interface GemFieldProps extends ComponentProps<typeof Input> {
  label: string;
  showLabel?: boolean;
  /** Renders the live read view when false and the input control when true. */
  editing?: boolean;
  displayValue?: ReactNode;
  valueTextRole?: GemFieldTextRole;
  density?: GemFieldDensity;
  onDisplayClick?: () => void;
  error?: string;
  required?: boolean;
  multiline?: boolean;
  width?: GemFieldWidth;
  /** Semantic primitive contract used to select validation and input behavior. */
  primitive?: Extract<GemPrimitiveType, "text" | "number" | "url" | "email" | "phone">;
}

/** Shared labelled text field with standard prompt, type, and validation properties. */
export const GemField = forwardRef<HTMLInputElement | HTMLTextAreaElement, GemFieldProps>(function GemField(
  {
    label,
    showLabel = true,
    id,
    error,
    required = false,
    multiline = false,
    width = "long",
    className,
    editing = true,
    displayValue,
    valueTextRole = "body",
    density = "standard",
    onDisplayClick,
    primitive,
    ...props
  },
  ref,
) {
  const generatedID = useId();
  const inputID = id ?? generatedID;
  const errorID = `${inputID}-error`;
  const compactControl = density === "compact" ? "gem-field-control--compact" : "";
  const compactRoot = density === "compact" ? "gem-field-density--compact" : "";
  const controlClassName = ["create-form-control", `create-form-control--${width}`, compactControl, className]
    .filter(Boolean)
    .join(" ");
  const primitiveType = primitive === "phone" ? "tel" : primitive;
  const primitiveInputMode = primitive === "number" ? "decimal" : primitive === "phone" ? "tel" : undefined;
  if (!editing) {
    return (
      <GemFieldRoot className={`gem-field-display ${compactRoot}`}>
        <GemFieldLabel id={`${inputID}-display-label`} className={showLabel ? "g-field-label" : "sr-only"}>
          {label}
        </GemFieldLabel>
        <GemFieldDisplayValue
          aria-describedby={`${inputID}-display-label`}
          onClick={onDisplayClick}
          textRole={valueTextRole}
        >
          {displayValue ?? props.value ?? "—"}
        </GemFieldDisplayValue>
      </GemFieldRoot>
    );
  }

  return (
    <GemFieldRoot className={`create-form-field ${compactRoot}`}>
      {showLabel ? (
        <GemFieldLabel className="g-field-label" htmlFor={inputID}>
          {label}
          {required ? " *" : ""}
        </GemFieldLabel>
      ) : null}
      {multiline ? (
        <GemTextArea
          {...props}
          type={primitiveType ?? props.type}
          inputMode={primitiveInputMode ?? props.inputMode}
          id={inputID}
          ref={ref as never}
          className={controlClassName}
          fontSize={valueTextRole === "caption" ? "$1" : undefined}
          lineHeight={valueTextRole === "caption" ? "$1" : undefined}
          fontWeight={valueTextRole === "caption" ? "500" : undefined}
          fieldWidth={width}
          fieldDensity={density}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorID : undefined}
          required={required}
          readOnly={false}
          aria-label={showLabel ? undefined : label}
        />
      ) : (
        <GemInput
          {...props}
          type={primitiveType ?? props.type}
          inputMode={primitiveInputMode ?? props.inputMode}
          id={inputID}
          ref={ref as never}
          className={controlClassName}
          fontSize={valueTextRole === "caption" ? "$1" : undefined}
          lineHeight={valueTextRole === "caption" ? "$1" : undefined}
          fontWeight={valueTextRole === "caption" ? "500" : undefined}
          fieldWidth={width}
          fieldDensity={density}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorID : undefined}
          required={required}
          readOnly={false}
          aria-label={showLabel ? undefined : label}
        />
      )}
      {error && (
        <GemFieldError id={errorID} role="alert">
          {error}
        </GemFieldError>
      )}
    </GemFieldRoot>
  );
});
