import type { ComponentProps } from "react";
import { SizableText } from "tamagui";

export interface GemStatusPillProps extends ComponentProps<typeof SizableText> {
  tone?: "default" | "success" | "warning" | "danger";
  wireframe?: boolean;
}

/** Shared compact status indicator for records and workflows. */
export function GemStatusPill({
  tone = "default",
  wireframe = false,
  children,
  className,
  ...props
}: GemStatusPillProps) {
  return (
    <SizableText
      {...props}
      role={props.role ?? "status"}
      className={`status-pill status-${tone}${wireframe ? " status-pill--wireframe" : ""}${className ? ` ${className}` : ""}`}
    >
      {children}
    </SizableText>
  );
}
