interface RecordCreateButtonProps {
  /** Human-readable record name used in the accessible button label. */
  label: string;
  /** Opens the feature-owned create form. */
  onCreate: () => void;
}

/** Render the shared empty-collection entry point for a feature create form. */
export function RecordCreateButton({ label, onCreate }: RecordCreateButtonProps) {
  return (
    <button type="button" onClick={onCreate}>
      Add {label}
    </button>
  );
}
