import type { ReactNode } from "react";
import { GemStatusPill } from "./GemStatusPill";

function statusTone(status: ReactNode): "default" | "success" | "warning" | "danger" {
  if (typeof status !== "string") return "default";
  const value = status.toLowerCase();
  if (value.includes("active") || value.includes("current") || value.includes("completed")) return "success";
  if (value.includes("paused") || value.includes("leave") || value.includes("seasonal")) return "warning";
  if (value.includes("closed") || value.includes("former")) return "danger";
  return "default";
}

export interface GemRecordCardProps {
  className: string;
  icon: ReactNode;
  title: string;
  subtitle: string;
  properties?: Array<{ label: string; value: ReactNode }>;
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
  properties = [],
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
      aria-expanded={selected}
      onClick={onSelect}
    >
      <span className={`${className}-icon`} aria-hidden="true">
        {icon}
      </span>
      <span className={`${className}-copy`}>
        <strong>{title}</strong>
        <small>{subtitle}</small>
        {properties.length > 0 && (
          <span className="gem-record-properties" aria-label="Selected properties">
            {properties.map(({ label, value }) => (
              <span className="gem-record-property" key={label}>
                <span className="gem-record-property-label">{label}</span>
                <span className="gem-record-property-value">{value || "—"}</span>
              </span>
            ))}
          </span>
        )}
      </span>
      {status ? (
        <GemStatusPill className="gem-record-status" tone={statusTone(status)} data-record-status>
          {status}
        </GemStatusPill>
      ) : null}
    </button>
  );
}
