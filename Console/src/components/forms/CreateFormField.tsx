import { Controller, type Control, type FieldValues, type Path, type UseFormReturn } from "react-hook-form";
import { Checkbox, Label, XStack, YStack } from "tamagui";
import {
  CreateFieldFrame,
  CreateSearchableSelectField,
  CreateSelectField,
  CreateTextField,
} from "./CreateForm";

/** Render a reusable text field from any React Hook Form shape. */
export function CreateFormText<T extends FieldValues>({
  form,
  name,
  label,
  required = false,
  type = "text",
  multiline = false,
  placeholder,
  width = "long",
}: {
  form: UseFormReturn<T>;
  name: Path<T>;
  label: string;
  required?: boolean;
  type?: string;
  multiline?: boolean;
  placeholder?: string;
  width?: "short" | "medium" | "long";
}) {
  const message = form.formState.errors[name]?.message;
  return (
    <CreateTextField
      label={label}
      registration={form.register(name)}
      required={required}
      type={type}
      multiline={multiline}
      placeholder={placeholder}
      width={width}
      error={typeof message === "string" ? message : undefined}
    />
  );
}

/** Render a reusable select field from any React Hook Form shape. */
export function CreateFormSelect<T extends FieldValues>({
  form,
  name,
  label,
  options,
  required = false,
  searchable = false,
  searchPlaceholder,
}: {
  form: UseFormReturn<T>;
  name: Path<T>;
  label: string;
  options: Array<{ value: string; label: string }>;
  required?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
}) {
  const message = form.formState.errors[name]?.message;
  return (
    <Controller
      control={form.control as Control<T>}
      name={name}
      render={({ field }) =>
        searchable ? (
          <CreateSearchableSelectField
            label={label}
            name={field.name}
            value={String(field.value ?? "")}
            onValueChange={field.onChange}
            onBlur={field.onBlur}
            options={options}
            required={required}
            searchPlaceholder={searchPlaceholder}
            error={typeof message === "string" ? message : undefined}
          />
        ) : (
          <CreateSelectField
            label={label}
            name={field.name}
            value={String(field.value ?? "")}
            onValueChange={field.onChange}
            onBlur={field.onBlur}
            options={options}
            required={required}
            error={typeof message === "string" ? message : undefined}
          />
        )
      }
    />
  );
}

/** Render a reusable Tamagui checkbox backed by a boolean form value. */
export function CreateFormCheckbox<T extends FieldValues>({
  form,
  name,
  label,
  required = false,
}: {
  form: UseFormReturn<T>;
  name: Path<T>;
  label: string;
  required?: boolean;
}) {
  const message = form.formState.errors[name]?.message;
  const checked = Boolean(form.watch(name));
  const id = String(name);
  return (
    <CreateFieldFrame id={id} label={label} required={required} error={typeof message === "string" ? message : undefined}>
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(checked) => form.setValue(name, (checked === true) as never, { shouldValidate: true, shouldDirty: true })}
        aria-invalid={Boolean(message)}
        aria-required={required}
      >
        <Checkbox.Indicator />
      </Checkbox>
    </CreateFieldFrame>
  );
}

/** Render a reusable multi-select as a Tamagui checkbox group backed by string values. */
export function CreateFormMultiSelect<T extends FieldValues>({
  form,
  name,
  label,
  options,
  required = false,
}: {
  form: UseFormReturn<T>;
  name: Path<T>;
  label: string;
  options: Array<{ value: string; label: string }>;
  required?: boolean;
}) {
  const message = form.formState.errors[name]?.message;
  const selected = (form.watch(name) as unknown as string[] | undefined) ?? [];
  const id = String(name);

  return (
    <CreateFieldFrame id={id} label={label} required={required} error={typeof message === "string" ? message : undefined}>
      <YStack gap="$2" role="group" aria-label={label}>
        {options.map((option) => {
          const optionId = `${id}-${option.value}`;
          const checked = selected.includes(option.value);
          return (
            <XStack key={option.value} alignItems="center" gap="$2">
              <Checkbox
                id={optionId}
                checked={checked}
                onCheckedChange={(nextChecked) => {
                  const nextValues = nextChecked === true
                    ? [...selected.filter((value) => value !== option.value), option.value]
                    : selected.filter((value) => value !== option.value);
                  form.setValue(name, nextValues as never, { shouldValidate: true, shouldDirty: true });
                }}
              >
                <Checkbox.Indicator />
              </Checkbox>
              <Label htmlFor={optionId}>{option.label}</Label>
            </XStack>
          );
        })}
      </YStack>
    </CreateFieldFrame>
  );
}
