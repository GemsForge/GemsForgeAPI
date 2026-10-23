import { forwardRef, useId, type ComponentProps, type Ref } from "react";
import { Input, Label, SizableText, TextArea, YStack } from "tamagui";

export type GemFieldWidth = "short" | "medium" | "long";

export interface GemFieldProps extends ComponentProps<typeof Input> {
  label: string;
  error?: string;
  required?: boolean;
  multiline?: boolean;
  width?: GemFieldWidth;
}

/** Shared labelled text field for forms and editors. */
export const GemField = forwardRef<HTMLInputElement | HTMLTextAreaElement, GemFieldProps>(function GemField(
  { label, id, error, required = false, multiline = false, width = "long", className, ...props },
  ref,
) {
  const generatedID = useId();
  const inputID = id ?? generatedID;
  const errorID = `${inputID}-error`;
  const controlClassName = ["create-form-control", `create-form-control--${width}`, className].filter(Boolean).join(" ");
  return (
    <YStack className="create-form-field" gap="$1">
      <Label htmlFor={inputID} color="$gemMuted" fontSize="$2" fontWeight="700">
        {label}{required ? " *" : ""}
      </Label>
      {multiline ? (
        <TextArea {...props} id={inputID} ref={ref as Ref<HTMLTextAreaElement>} className={controlClassName} aria-invalid={Boolean(error)} aria-describedby={error ? errorID : undefined} required={required} />
      ) : (
        <Input {...props} id={inputID} ref={ref as Ref<HTMLInputElement>} className={controlClassName} aria-invalid={Boolean(error)} aria-describedby={error ? errorID : undefined} required={required} />
      )}
      {error && <SizableText id={errorID} role="alert" color="$gemDanger" fontSize="$1">{error}</SizableText>}
    </YStack>
  );
});
