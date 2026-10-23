import { Controller, type Control, type FieldValues, type Path, type UseFormReturn } from "react-hook-form";
import { CreateSearchableSelectField, CreateSelectField, CreateTextField } from "./CreateForm";

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
