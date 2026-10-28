import { forwardRef, useId, type ComponentProps, type ReactNode, type Ref } from "react";
import { Input, Label, SizableText, TextArea, YStack } from "tamagui";
import type { GemPrimitiveType } from "./primitiveFieldContracts";

/** Standard reusable field widths shared by generic and feature forms. */
export type GemFieldWidth = "short" | "medium" | "long";

export interface GemFieldProps extends ComponentProps<typeof Input> {
  label: string;
  /** Renders the live read view when false and the input control when true. */
  editing?: boolean;
  displayValue?: ReactNode;
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
    id,
    error,
    required = false,
    multiline = false,
    width = "long",
    className,
    editing = true,
    displayValue,
    onDisplayClick,
    primitive,
    ...props
  },
  ref,
) {
  const generatedID = useId();
  const inputID = id ?? generatedID;
  const errorID = `${inputID}-error`;
  const controlClassName = ["create-form-control", `create-form-control--${width}`, className].filter(Boolean).join(" ");
  const primitiveType = primitive === "phone" ? "tel" : primitive;
  const primitiveInputMode = primitive === "number" ? "decimal" : primitive === "phone" ? "tel" : undefined;
  if (!editing) {
    return (
      <YStack className="gem-field-display" gap="$1">
        <Label color="$gemGold" fontSize="$2" fontWeight="800" textTransform="uppercase">
          {label}
        </Label>
        <button type="button" className="gem-field-display-value" onClick={onDisplayClick}>
          {displayValue ?? props.value ?? "—"}
        </button>
      </YStack>
    );
  }

  return (
    <YStack className="create-form-field" gap="$1">
        <Label htmlFor={inputID} color="$gemGold" fontSize="$2" fontWeight="800" textTransform="uppercase">
        {label}{required ? " *" : ""}
      </Label>
      {multiline ? (
        <TextArea
          {...props}
          type={primitiveType ?? props.type}
          inputMode={primitiveInputMode ?? props.inputMode}
          id={inputID}
          ref={ref as Ref<HTMLTextAreaElement>}
          className={controlClassName}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorID : undefined}
          required={required}
        />
      ) : (
        <Input
          {...props}
          type={primitiveType ?? props.type}
          inputMode={primitiveInputMode ?? props.inputMode}
          id={inputID}
          ref={ref as Ref<HTMLInputElement>}
          className={controlClassName}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorID : undefined}
          required={required}
        />
      )}
      {error && (
        <SizableText id={errorID} role="alert" color="$gemDanger" fontSize="$1">
          {error}
        </SizableText>
      )}
    </YStack>
  );
});
