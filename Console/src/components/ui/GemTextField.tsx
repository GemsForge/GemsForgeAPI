import { forwardRef, useId, type ComponentProps } from "react";
import { Input, Label, SizableText, TextArea, YStack } from "tamagui";

export type GemTextFieldWidth = "short" | "medium" | "long";

export interface GemTextFieldProps extends ComponentProps<typeof Input> {
  label: string;
  error?: string;
  required?: boolean;
  multiline?: boolean;
  width?: GemTextFieldWidth;
}

/** Shared labelled text field for forms and editors. */
export const GemTextField = forwardRef<HTMLInputElement | HTMLTextAreaElement, GemTextFieldProps>(function GemTextField(
  { label, id, error, required = false, multiline = false, width = "long", className, ...props },
  ref,
) {
  const generatedID = useId();
  const inputID = id ?? generatedID;
  const errorID = `${inputID}-error`;
  const controlClassName = ["create-form-control", `create-form-control--${width}`, className]
    .filter(Boolean)
    .join(" ");
  return (
    <YStack className="create-form-field" gap="$1">
      <Label htmlFor={inputID} color="$gemGold" fontSize="$2" fontWeight="800" textTransform="uppercase">
        {label}
        {required ? " *" : ""}
      </Label>
      {multiline ? (
        <TextArea
          {...props}
          id={inputID}
          ref={ref as never}
          className={controlClassName}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorID : undefined}
          required={required}
        />
      ) : (
        <Input
          {...props}
          id={inputID}
          ref={ref as never}
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

/** Backward-compatible name for the standard text field. */
export const GemField = GemTextField;
