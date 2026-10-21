import { useState, type ReactNode } from "react";
import type { UseFormRegisterReturn } from "react-hook-form";
import { Form, Input, Label, Select, SizableText, TextArea, YStack } from "tamagui";

interface CreateFieldFrameProps {
  id: string;
  label: string;
  required: boolean;
  error?: string;
  children: ReactNode;
}

/** Apply the shared label, control spacing, and validation message contract to every create field. */
function CreateFieldFrame({ id, label, required, error, children }: CreateFieldFrameProps) {
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

const controlStyle = {
  width: "100%" as const,
  minHeight: "$5" as const,
  borderColor: "$gemPanelLight" as const,
  borderWidth: 1,
  borderRadius: "$gemControl" as const,
  backgroundColor: "$gemCanvas" as const,
  color: "$gemInk" as const,
};

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
  multiline = false,
}: {
  label: string;
  registration: UseFormRegisterReturn;
  error?: string;
  required?: boolean;
  type?: string;
  multiline?: boolean;
}) {
  const id = registration.name;
  return (
    <CreateFieldFrame id={id} label={label} required={required} error={error}>
      {multiline ? (
        <TextArea
          id={id}
          className="create-form-control"
          {...controlStyle}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          required={required}
          {...registration}
          ref={(element) => registration.ref(element as HTMLTextAreaElement | null)}
        />
      ) : (
        <Input
          id={id}
          className="create-form-control"
          {...controlStyle}
          type={type}
          required={required}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          {...registration}
          ref={(element) => registration.ref(element as HTMLInputElement | null)}
        />
      )}
    </CreateFieldFrame>
  );
}

interface CreateSelectControlProps {
  id: string;
  name: string;
  value: string;
  onValueChange: (value: string) => void;
  onBlur: () => void;
  error?: string;
  options: Array<{ value: string; label: string }>;
  required: boolean;
}

/** Render the shared select control used by both regular and searchable selectors. */
function CreateSelectControl({
  id,
  name,
  value,
  onValueChange,
  onBlur,
  error,
  options,
  required,
}: CreateSelectControlProps) {
  return (
    <Select name={name} value={value || undefined} onValueChange={onValueChange}>
      <Select.Trigger
        id={id}
        className="create-form-control"
        {...controlStyle}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        aria-required={required}
        onBlur={onBlur}
      >
        <Select.Value placeholder="Select…" />
      </Select.Trigger>
      <Select.Content>
        <Select.Viewport minWidth={240}>
          {options.map((option) => (
            <Select.Item key={option.value} value={option.value}>
              <Select.ItemText>{option.label}</Select.ItemText>
            </Select.Item>
          ))}
        </Select.Viewport>
      </Select.Content>
    </Select>
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
    <CreateFieldFrame id={id} label={label} required={required} error={error}>
      <CreateSelectControl
        id={id}
        name={name}
        value={value}
        onValueChange={onValueChange}
        onBlur={onBlur}
        error={error}
        options={options}
        required={required}
      />
    </CreateFieldFrame>
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
    <CreateFieldFrame id={name} label={label} required={required} error={error}>
      <YStack gap="$2">
        <Input
          type="search"
          className="create-form-control"
          {...controlStyle}
          aria-label={`Search ${label}`}
          placeholder={searchPlaceholder}
          autoComplete="off"
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
        />
        <CreateSelectControl
          id={name}
          name={name}
          value={value}
          onValueChange={onValueChange}
          onBlur={onBlur}
          error={error}
          options={filteredOptions}
          required={required}
        />
      </YStack>
    </CreateFieldFrame>
  );
}
