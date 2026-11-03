import { useId, useRef, type ReactNode } from "react";
import { GemFieldDisplayValue } from "./fieldPrimitives";

const IMAGE_ACCEPT = "image/jpeg,image/png";

export interface GImageFieldProps {
  label?: string;
  value?: string | null;
  editing?: boolean;
  displayValue?: ReactNode;
  onDisplayClick?: () => void;
  onChange?: (file: File | null) => void;
  error?: string;
}

export function GImageField({ label = "Image", value, editing = true, displayValue, onDisplayClick, onChange, error }: GImageFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const id = useId();
  if (!editing) {
    return (
      <div className="gem-image-field gem-field-display">
        <GemFieldDisplayValue onClick={onDisplayClick} aria-label={onDisplayClick ? `Edit ${label}` : undefined}>
          {displayValue ?? (value ? <img className="wireframe-property-image" src={value} alt={`${label} preview`} /> : "—")}
        </GemFieldDisplayValue>
      </div>
    );
  }
  return (
    <div className="gem-image-field">
      <label htmlFor={id}>{label}</label>
      {value ? <img className="wireframe-property-image" src={value} alt={`${label} preview`} /> : null}
      <input ref={inputRef} id={id} type="file" accept={IMAGE_ACCEPT} onChange={(event) => onChange?.(event.target.files?.[0] ?? null)} />
      {error ? <span role="alert">{error}</span> : null}
    </div>
  );
}
