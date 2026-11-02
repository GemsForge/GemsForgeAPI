import { useState, type ReactNode } from "react";
import type { UseFormRegisterReturn } from "react-hook-form";
import { Form, SizableText, YStack } from "tamagui";
import { GemField } from "../ui/GemField";
import { GemButton } from "../ui/GemButton";
import { GSearchField } from "../ui/GSearchField";
import { GSelectField } from "../ui/GSelectField";
import { GemFieldError, GemFieldLabel } from "../ui/fieldPrimitives";

interface CreateFieldFrameProps {
  id: string;
  label: string;
  required: boolean;
  error?: string;
  children: ReactNode;
}

/** Apply the shared label, control spacing, and validation message contract to every create field. */
export function CreateFieldFrame({ id, label, required, error, children }: CreateFieldFrameProps) {
  const errorId = `${id}-error`;
  return (
    <YStack className="create-form-field" gap="$1">
      <GemFieldLabel htmlFor={id}>
        {label}
        {required ? " *" : ""}
      </GemFieldLabel>
      {children}
      {error && (
        <GemFieldError id={errorId} role="alert">
          {error}
        </GemFieldError>
      )}
    </YStack>
  );
}

/** Constrain shared text controls to the width appropriate for their value. */
export type CreateFieldWidth = "short" | "medium" | "long";

/** Give every text control a useful prompt while allowing a feature to provide a more specific one. */
function defaultTextPlaceholder(label: string): string {
  return `Enter ${label.toLowerCase()}…`;
}

/** Render the shared Tamagui form shell used by every record-creation workflow. */
export function CreateFormFrame({
  title,
  className,
  submitting,
  error,
  onCancel,
  onSubmit,
  children,
}: {
  title: string;
  className?: string;
  submitting: boolean;
  error: string | null;
  onCancel: () => void;
  onSubmit: () => void;
  children: ReactNode;
}) {
  return (
    <Form className={`edit-form create-record-form${className ? ` ${className}` : ""}`} aria-label={title} onSubmit={onSubmit}>
      <SizableText className="create-record-form-title" size="$4" fontWeight="700" role="heading" aria-level={3}>
        {title}
      </SizableText>
      {error && <SizableText role="alert" color="$gemDanger">{error}</SizableText>}
      {children}
      <div className="button-row">
        <GemButton type="submit" disabled={submitting}>
          {submitting ? "Creating…" : "Create record"}
        </GemButton>
        <GemButton type="button" tone="secondary" onClick={onCancel} disabled={submitting}>
          Cancel
        </GemButton>
      </div>
    </Form>
  );
}

export function CreateTextField({
  label,
  registration,
  error,
  required = false,
  type = "text",
  multiline = false,
  placeholder,
  width = "long",
}: {
  label: string;
  registration: UseFormRegisterReturn;
  error?: string;
  required?: boolean;
  type?: string;
  multiline?: boolean;
  placeholder?: string;
  width?: CreateFieldWidth;
}) {
  const id = registration.name;
  const inputPlaceholder = placeholder ?? defaultTextPlaceholder(label);
  const controlClassName = `create-form-control create-form-control--${width}`;
  return (
    <GemField
      {...registration}
      ref={(element) => registration.ref(element)}
      id={id}
      label={label}
      error={error}
      required={required}
      type={type}
      step={type === "number" ? "any" : undefined}
      multiline={multiline}
      placeholder={inputPlaceholder}
      width={width}
      className={controlClassName}
    />
  );
}

interface CreateSelectFieldProps {
  label: string;
  name: string;
  value: string;
  onValueChange: (value: string) => void;
  onBlur: () => void;
  error?: string;
  options: Array<{ value: string; label: string }>;
  required?: boolean;
}

/** Render the shared select primitive while keeping React Hook Form as its value owner. */
export function CreateSelectField({
  label,
  name,
  value,
  onValueChange,
  onBlur,
  error,
  options,
  required = false,
}: CreateSelectFieldProps) {
  return <GSelectField id={name} label={label} value={value} onChange={onValueChange} onBlur={onBlur} error={error} options={options} required={required} wireframe />;
}

/** Render a searchable existing-record selector while preserving the selected record ID. */
export function CreateSearchableSelectField({
  label,
  name,
  value,
  onValueChange,
  onBlur,
  error,
  options,
  required = false,
  searchPlaceholder = "Search options…",
}: CreateSelectFieldProps & { searchPlaceholder?: string }) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const filteredOptions = normalizedQuery
    ? options.filter((option) => `${option.label} ${option.value}`.toLowerCase().includes(normalizedQuery))
    : options;

  return (
    <YStack gap="$2">
      <GSearchField label={`Search ${label}`} value={query} onChange={setQuery} placeholder={searchPlaceholder} width="long" />
      <GSelectField id={name} label={label} value={value} onChange={onValueChange} onBlur={onBlur} error={error} options={filteredOptions} required={required} wireframe />
    </YStack>
  );
}
