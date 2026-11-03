import { Input, Label, SizableText, styled, TextArea, YStack } from "tamagui";

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
  color: "$gemDanger",
  fontSize: "$1",
});
