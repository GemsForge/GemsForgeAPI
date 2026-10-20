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
      aria-expanded={selected}
      onClick={onSelect}
    >
      <span className={`${className}-icon`} aria-hidden="true">
        {icon}
      </span>
      <span className={`${className}-copy`}>
        <strong>{title}</strong>
        <small>{subtitle}</small>
      </span>
      {status ? (
        <GemStatusPill className="gem-record-status" tone={statusTone(status)} data-record-status>
          {status}
        </GemStatusPill>
      ) : null}
    </button>
  );
}
