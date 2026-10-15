import type { ReactNode } from "react";

export interface GemRecordCardProps {
  className: string;
  icon: ReactNode;
  title: string;
  subtitle: string;
  status?: ReactNode;
  selected?: boolean;
  ariaLabel?: string;
  onSelect: () => void;
}

/** Shared selectable record-card structure; feature views provide values and intent. */
export function GemRecordCard({
  className,
  icon,
  title,
  subtitle,
  status,
  selected = false,
  ariaLabel,
  onSelect,
}: GemRecordCardProps) {
  return (
    <button
      className={`${className}${selected ? " selected" : ""}`}
      aria-label={ariaLabel}
      aria-pressed={selected}
      onClick={onSelect}
    >
      <span className={`${className}-icon`} aria-hidden="true">
        {icon}
      </span>
      <span className={`${className}-copy`}>
        <strong>{title}</strong>
        <small>{subtitle}</small>
      </span>
      {status ? <span className={`${className}-status`}>{status}</span> : null}
    </button>
  );
}
