import type { ComponentProps } from "react";
import { SizableText } from "tamagui";

export interface GemStatusPillProps extends ComponentProps<typeof SizableText> {
  tone?: "default" | "success" | "warning" | "danger";
}

/** Shared compact status indicator for records and workflows. */
export function GemStatusPill({ tone = "default", children, className, ...props }: GemStatusPillProps) {
  return (
    <SizableText {...props} role={props.role ?? "status"} className={`status-pill status-${tone}${className ? ` ${className}` : ""}`}>
      {children}
    </SizableText>
  );
}
