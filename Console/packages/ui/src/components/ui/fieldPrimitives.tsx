import type { ReactNode } from "react";
import { Button, Input, Label, SizableText, styled, TextArea, YStack } from "tamagui";
import { GemCaption } from "./GemTypography";

export const GemFieldRoot = styled(YStack, {
  gap: "$1",
  marginBottom: "$3",
});

export const GemFieldLabel = styled(Label, {
  color: "$fieldLabel",
  fontSize: "$2",
  fontWeight: "800",
  letterSpacing: 1,
  lineHeight: "$2",
  textTransform: "uppercase",
});

export type GemFieldTextRole = "body" | "caption";
export type GemFieldDensity = "standard" | "compact";

const gemFieldDisplayStyles = {
  width: "100%",
  minWidth: 0,
  height: "auto",
  minHeight: 0,
  justifyContent: "flex-start",
  padding: 0,
  borderWidth: 0,
  borderRadius: 0,
  backgroundColor: "transparent",
  color: "$textMuted",
  fontFamily: "$body",
  fontSize: "$3",
  fontWeight: "400",
  lineHeight: "$3",
  textAlign: "left",
  textTransform: "none",
  whiteSpace: "normal",
  overflowWrap: "anywhere",
  wordBreak: "break-word",
};

const StyledGemFieldDisplayButton = styled(Button, {
  ...gemFieldDisplayStyles,
  cursor: "pointer",
});
const StyledGemFieldDisplayText = styled(SizableText, gemFieldDisplayStyles);

export interface GemFieldDisplayValueProps {
  children?: ReactNode;
  className?: string;
  onClick?: () => void;
  textRole?: GemFieldTextRole;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  "aria-label"?: string;
}

/** Theme-aware, keyboard-visible value button shared by read-mode fields. */
export function GemFieldDisplayValue({
  className,
  onClick,
  children,
  textRole = "body",
  ...accessibilityProps
}: GemFieldDisplayValueProps) {
  const mergedClassName = ["gem-field-display-value", className].filter(Boolean).join(" ");
  const content = textRole === "caption" ? <GemCaption>{children}</GemCaption> : children;
  if (!onClick) {
    return (
      <StyledGemFieldDisplayText
        {...accessibilityProps}
        className={mergedClassName}
        fontSize={textRole === "caption" ? "$1" : "$3"}
        lineHeight={textRole === "caption" ? "$1" : "$3"}
      >
        {content}
      </StyledGemFieldDisplayText>
    );
  }
  return (
    <StyledGemFieldDisplayButton type="button" {...accessibilityProps} onClick={onClick} className={mergedClassName}>
      {content}
    </StyledGemFieldDisplayButton>
  );
}

const fieldControlStyles = {
  width: "100%",
  maxWidth: "100%",
  minWidth: 0,
  minHeight: "$fieldControl",
  paddingHorizontal: "$3",
  paddingVertical: "$2",
  borderWidth: 1,
  borderRadius: "$gemControl",
  backgroundColor: "$fieldBackground",
  borderColor: "$fieldBorder",
  color: "$fieldText",
  outlineWidth: 0,
  focusStyle: {
    borderColor: "$fieldFocus",
  },
  variants: {
    fieldDensity: {
      standard: {},
      compact: {
        paddingVertical: "$1",
        paddingHorizontal: "$2",
      },
    },
    fieldWidth: {
      short: { maxWidth: "$fieldShort" },
      medium: { maxWidth: "$fieldMedium" },
      long: { maxWidth: "100%" },
    },
  } as const,
} as const;

export const GemInput = styled(Input, fieldControlStyles);
export const GemTextArea = styled(TextArea, fieldControlStyles);

export const GemFieldError = styled(SizableText, {
  color: "$danger",
  fontSize: "$1",
});
