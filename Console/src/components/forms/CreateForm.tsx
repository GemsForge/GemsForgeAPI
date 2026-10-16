import type { FormEvent, ReactNode } from "react";
import type { UseFormRegisterReturn } from "react-hook-form";

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
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  children: ReactNode;
}) {
  return (
    <form className="edit-form create-record-form" aria-label={title} noValidate onSubmit={onSubmit}>
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
    </form>
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
    <label htmlFor={id}>
      {label}
      {required ? " *" : ""}
      {multiline ? (
        <textarea
          id={id}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          {...registration}
        />
      ) : (
        <input
          id={id}
          type={type}
          required={required}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          {...registration}
        />
      )}
      {error && (
        <span id={`${id}-error`} className="field-error">
          {error}
        </span>
      )}
    </label>
  );
}

export function CreateSelectField({
  label,
  registration,
  error,
  options,
  required = false,
}: {
  label: string;
  registration: UseFormRegisterReturn;
  error?: string;
  options: Array<{ value: string; label: string }>;
  required?: boolean;
}) {
  const id = registration.name;
  return (
    <label htmlFor={id}>
      {label}
      {required ? " *" : ""}
      <select
        id={id}
        required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        {...registration}
      >
        <option value="">Select…</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && (
        <span id={`${id}-error`} className="field-error">
          {error}
        </span>
      )}
    </label>
  );
}
