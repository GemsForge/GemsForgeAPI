import type { ComponentProps } from "react";
import { SizableText } from "tamagui";

export interface GemStatusPillProps extends ComponentProps<typeof SizableText> {
  tone?: "default" | "success" | "warning" | "danger";
}

/** Shared compact status indicator for records and workflows. */
export function GemStatusPill({ tone = "default", children, ...props }: GemStatusPillProps) {
  return <SizableText {...props} className={`status-pill status-${tone}`}>{children}</SizableText>;
}
