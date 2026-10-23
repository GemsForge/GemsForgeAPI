import { useState, type ReactNode } from "react";
import type { UseFormRegisterReturn } from "react-hook-form";
import { Form, Label, SizableText, YStack } from "tamagui";
import { GSearchField, GSelectField, GemTextField } from "../ui";

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
      <Label htmlFor={id} color="$gemMuted" fontSize="$2" fontWeight="700">
        {label}
        {required ? " *" : ""}
      </Label>
      {children}
      {error && (
        <SizableText id={errorId} role="alert" color="$gemDanger" fontSize="$1">
          {error}
        </SizableText>
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
  submitting,
  error,
  onCancel,
  onSubmit,
  children,
}: {
  title: string;
  submitting: boolean;
  error: string | null;
  onCancel: () => void;
  onSubmit: () => void;
  children: ReactNode;
}) {
  return (
    <Form className="edit-form create-record-form" aria-label={title} onSubmit={onSubmit}>
      <h3>{title}</h3>
      {error && <p role="alert">{error}</p>}
      {children}
      <div className="button-row">
        <button type="submit" disabled={submitting}>
          {submitting ? "Creating…" : "Create record"}
        </button>
        <button type="button" className="secondary-button" onClick={onCancel} disabled={submitting}>
          Cancel
        </button>
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
  step,
  multiline = false,
  placeholder,
  width = "long",
}: {
  label: string;
  registration: UseFormRegisterReturn;
  error?: string;
  required?: boolean;
  type?: string;
  step?: string;
  multiline?: boolean;
  placeholder?: string;
  width?: CreateFieldWidth;
}) {
  const id = registration.name;
  const inputPlaceholder = placeholder ?? defaultTextPlaceholder(label);
  return (
    <GemTextField
      {...registration}
      ref={(element) => registration.ref(element)}
      id={id}
      label={label}
      error={error}
      required={required}
      type={type}
      step={step}
      multiline={multiline}
      placeholder={inputPlaceholder}
      width={width}
      className="create-form-control"
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

/** Render a keyboard-accessible Tamagui select while keeping React Hook Form as its value owner. */
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
  const id = name;
  return (
    <GSelectField
      label={label}
      id={id}
      value={value}
      onChange={onValueChange}
      options={options}
      required={required}
      error={error}
      onBlur={onBlur}
    />
  );
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
      <GSearchField
        label={`Search ${label}`}
        value={query}
        onChange={setQuery}
        placeholder={searchPlaceholder}
        variant="regular"
      />
      <GSelectField
        label={label}
        id={name}
        value={value}
        onChange={onValueChange}
        options={filteredOptions}
        required={required}
        error={error}
        onBlur={onBlur}
      />
    </YStack>
  );
}
